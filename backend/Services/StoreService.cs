using System.Globalization;
using System.Text.Json;
using EspaceShoppingPlus.Api.DTOs;
using EspaceShoppingPlus.Api.Interfaces;
using Npgsql;

namespace EspaceShoppingPlus.Api.Services;

public sealed class StoreService(
    NpgsqlDataSource? dataSource) : IStoreService
{
    private static readonly JsonSerializerOptions DatabaseJsonOptions = new(JsonSerializerDefaults.Web);

    public bool IsConfigured => dataSource is not null;

    public async Task<StoreCatalogDto> GetCatalogAsync(CancellationToken cancellationToken)
    {
        var products = await ReadProductsAsync(null, cancellationToken);
        const string sql = """
            SELECT name, slug, image, is_active, is_featured, sort_order
            FROM store_categories
            WHERE is_active = true
            ORDER BY sort_order, name
            """;

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var categories = new List<StoreCategoryDto>();
        while (await reader.ReadAsync(cancellationToken))
        {
            categories.Add(new StoreCategoryDto(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetBoolean(3),
                reader.GetBoolean(4),
                reader.GetInt32(5)));
        }

        return new StoreCatalogDto(products, categories);
    }

    public async Task<StoreProductDto?> GetProductAsync(string slug, CancellationToken cancellationToken)
    {
        var products = await ReadProductsAsync(slug, cancellationToken);
        return products.Count == 0 ? null : products[0];
    }

    public async Task<IReadOnlyList<CustomerOrderDto>> GetCustomerOrdersAsync(
        string customerId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT o.id, o.status, o.payment_method, o.payment_status,
                   o.subtotal_cfa, o.delivery_fee_cfa, o.total_cfa, o.delivery_zone, o.created_at,
                   COALESCE(json_agg(json_build_object(
                       'name', i.product_name, 'quantity', i.quantity, 'lineTotalCfa', i.line_total_cfa,
                       'size', i.size, 'color', i.color
                   )) FILTER (WHERE i.id IS NOT NULL), '[]'::json)::text AS items
            FROM store_orders o
            LEFT JOIN store_order_items i ON i.order_id = o.id
            WHERE o.customer_id = @customerId
            GROUP BY o.id
            ORDER BY o.created_at DESC
            LIMIT 50
            """;

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("customerId", customerId);

        var orders = new List<CustomerOrderDto>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var items = JsonSerializer.Deserialize<List<CustomerOrderItemDto>>(
                reader.GetString(9),
                DatabaseJsonOptions) ?? [];
            orders.Add(new CustomerOrderDto(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetInt32(4),
                reader.GetInt32(5),
                reader.GetInt32(6),
                reader.IsDBNull(7) ? null : reader.GetString(7),
                reader.GetDateTime(8),
                items));
        }

        return orders;
    }

    public async Task<bool> SaveFapshiCheckoutSessionAsync(
        Guid orderId,
        string transId,
        string checkoutUrl,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE store_orders
            SET fapshi_trans_id = @transId,
                fapshi_checkout_url = @checkoutUrl,
                updated_at = now()
            WHERE id = @orderId
              AND payment_method = 'fapshi'
              AND payment_status = 'pending'
              AND fapshi_trans_id IS NULL
            """;

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("orderId", orderId);
        command.Parameters.AddWithValue("transId", transId);
        command.Parameters.AddWithValue("checkoutUrl", checkoutUrl);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public async Task<bool> FailFapshiOrderAndRestoreStockAsync(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        const string updateOrderSql = """
            UPDATE store_orders
            SET payment_status = 'failed', updated_at = now()
            WHERE id = @orderId
              AND payment_method = 'fapshi'
              AND payment_status = 'pending'
              AND fapshi_trans_id IS NULL
            """;
        await using var updateOrder = new NpgsqlCommand(updateOrderSql, connection, transaction);
        updateOrder.Parameters.AddWithValue("orderId", orderId);
        if (await updateOrder.ExecuteNonQueryAsync(cancellationToken) != 1)
        {
            await transaction.RollbackAsync(cancellationToken);
            return false;
        }

        const string restoreStockSql = """
            UPDATE store_products p
            SET stock_quantity = p.stock_quantity + i.quantity,
                is_available = true,
                updated_at = now()
            FROM store_order_items i
            WHERE i.order_id = @orderId
              AND p.slug = i.product_slug
            """;
        await using var restoreStock = new NpgsqlCommand(restoreStockSql, connection, transaction);
        restoreStock.Parameters.AddWithValue("orderId", orderId);
        await restoreStock.ExecuteNonQueryAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return true;
    }

    public async Task<FapshiPaymentUpdateResult> UpdateFapshiPaymentStatusAsync(
        Guid orderId,
        string transId,
        string status,
        int amount,
        OwnerPayoutReservation? ownerPayout,
        CancellationToken cancellationToken)
    {
        if (status is not ("confirmed" or "failed") || string.IsNullOrWhiteSpace(transId) || amount < 1)
        {
            return FapshiPaymentUpdateResult.Rejected;
        }

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        const string readSql = """
            SELECT payment_status, total_cfa
            FROM store_orders
            WHERE id = @orderId
              AND payment_method = 'fapshi'
              AND fapshi_trans_id = @transId
            FOR UPDATE
            """;
        await using var readOrder = new NpgsqlCommand(readSql, connection, transaction);
        readOrder.Parameters.AddWithValue("orderId", orderId);
        readOrder.Parameters.AddWithValue("transId", transId);
        string currentStatus;
        await using (var reader = await readOrder.ExecuteReaderAsync(cancellationToken))
        {
            if (!await reader.ReadAsync(cancellationToken) || reader.GetInt32(1) != amount)
            {
                await reader.DisposeAsync();
                await transaction.RollbackAsync(cancellationToken);
                return FapshiPaymentUpdateResult.Rejected;
            }

            currentStatus = reader.GetString(0);
        }

        // Idempotent replays, and a late "failed" event never downgrades a paid order.
        if (currentStatus == status || currentStatus == "confirmed")
        {
            await transaction.RollbackAsync(cancellationToken);
            return FapshiPaymentUpdateResult.AlreadyProcessed;
        }

        if (currentStatus is not ("pending" or "failed"))
        {
            await transaction.RollbackAsync(cancellationToken);
            return FapshiPaymentUpdateResult.Rejected;
        }

        const string updateSql = """
            UPDATE store_orders
            SET payment_status = @status,
                updated_at = now()
            WHERE id = @orderId
            """;
        await using var updateOrder = new NpgsqlCommand(updateSql, connection, transaction);
        updateOrder.Parameters.AddWithValue("orderId", orderId);
        updateOrder.Parameters.AddWithValue("status", status);
        await updateOrder.ExecuteNonQueryAsync(cancellationToken);

        if (status == "failed")
        {
            // pending -> failed: release the reserved stock.
            await RestoreOrderStockAsync(connection, transaction, orderId, cancellationToken);
        }
        else if (currentStatus == "failed")
        {
            // failed -> confirmed (customer retried or paid after the reservation expired):
            // the money was received, so take the stock again.
            const string reserveAgainSql = """
                UPDATE store_products p
                SET stock_quantity = GREATEST(p.stock_quantity - i.quantity, 0),
                    is_available = (p.stock_quantity - i.quantity > 0),
                    updated_at = now()
                FROM store_order_items i
                WHERE i.order_id = @orderId
                  AND p.slug = i.product_slug
                """;
            await using var reserveAgain = new NpgsqlCommand(reserveAgainSql, connection, transaction);
            reserveAgain.Parameters.AddWithValue("orderId", orderId);
            await reserveAgain.ExecuteNonQueryAsync(cancellationToken);
        }

        if (status == "confirmed" && ownerPayout is not null)
        {
            var phoneNumber = ownerPayout.PhoneNumber?.Trim();
            var canSubmit = ownerPayout.Enabled &&
                ownerPayout.ConfigurationComplete &&
                ownerPayout.AmountCfa is >= 100 and <= 500_000 &&
                !string.IsNullOrWhiteSpace(phoneNumber);
            var payoutStatus = !ownerPayout.Enabled
                ? "disabled"
                : canSubmit ? "queued" : "manual_review";
            var details = ownerPayout.Enabled && !canSubmit
                ? "Montant ou configuration du décaissement à vérifier."
                : null;

            const string insertPayoutSql = """
                INSERT INTO store_owner_payouts (
                    order_id, amount_cfa, destination, external_id, user_id, base_url, status, details
                )
                VALUES (
                    @orderId, @amount, @destination, @externalId, @userId, @baseUrl, @status, @details
                )
                ON CONFLICT (order_id) DO NOTHING
                """;
            await using var insertPayout = new NpgsqlCommand(insertPayoutSql, connection, transaction);
            insertPayout.Parameters.AddWithValue("orderId", orderId);
            insertPayout.Parameters.AddWithValue(
                "amount",
                ownerPayout.AmountCfa is null ? DBNull.Value : ownerPayout.AmountCfa.Value);
            insertPayout.Parameters.AddWithValue(
                "destination",
                string.IsNullOrWhiteSpace(phoneNumber) ? DBNull.Value : phoneNumber);
            insertPayout.Parameters.AddWithValue("externalId", orderId.ToString("D"));
            insertPayout.Parameters.AddWithValue("userId", $"store-{orderId:N}");
            insertPayout.Parameters.AddWithValue("baseUrl", ownerPayout.BaseUrl);
            insertPayout.Parameters.AddWithValue("status", payoutStatus);
            insertPayout.Parameters.AddWithValue(
                "details",
                details is null ? DBNull.Value : details);
            await insertPayout.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return FapshiPaymentUpdateResult.Updated;
    }

    public async Task<OwnerPayout?> TryStartOwnerPayoutAsync(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE store_owner_payouts
            SET status = 'submitting', updated_at = now()
            WHERE order_id = @orderId
              AND status = 'queued'
            RETURNING order_id, amount_cfa, destination, external_id, user_id, base_url
            """;

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("orderId", orderId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new OwnerPayout(
            reader.GetGuid(0),
            reader.GetInt32(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5));
    }

    public async Task<OwnerPayout?> TryStartNextOwnerPayoutAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            WITH next_payout AS (
                SELECT order_id
                FROM store_owner_payouts
                WHERE status = 'queued'
                ORDER BY created_at
                FOR UPDATE SKIP LOCKED
                LIMIT 1
            )
            UPDATE store_owner_payouts p
            SET status = 'submitting', updated_at = now()
            FROM next_payout
            WHERE p.order_id = next_payout.order_id
            RETURNING p.order_id, p.amount_cfa, p.destination, p.external_id, p.user_id, p.base_url
            """;

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new OwnerPayout(
            reader.GetGuid(0),
            reader.GetInt32(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5));
    }

    public async Task<int> FlagStaleOwnerPayoutsAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE store_owner_payouts
            SET status = 'manual_review',
                details = 'Tentative interrompue; vérifier Fapshi avant toute nouvelle tentative.',
                updated_at = now()
            WHERE status = 'submitting'
              AND updated_at < now() - interval '5 minutes'
            """;

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        return await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> CompleteOwnerPayoutSubmissionAsync(
        Guid orderId,
        string status,
        string? transId,
        string? details,
        CancellationToken cancellationToken)
    {
        if (status is not ("submitted" or "manual_review") ||
            status == "submitted" && string.IsNullOrWhiteSpace(transId))
        {
            return false;
        }

        const string sql = """
            UPDATE store_owner_payouts
            SET status = CASE WHEN status = 'submitting' THEN @status ELSE status END,
                fapshi_trans_id = COALESCE(fapshi_trans_id, @transId),
                details = CASE WHEN status = 'submitting' THEN @details ELSE details END,
                updated_at = now()
            WHERE order_id = @orderId
              AND (
                  status = 'submitting'
                  OR status IN ('successful', 'failed')
                    AND (@transId IS NULL OR fapshi_trans_id = @transId)
              )
            """;

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("orderId", orderId);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("transId", string.IsNullOrWhiteSpace(transId) ? DBNull.Value : transId);
        command.Parameters.AddWithValue("details", string.IsNullOrWhiteSpace(details) ? DBNull.Value : details);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public async Task<bool> UpdateOwnerPayoutStatusAsync(
        Guid orderId,
        string transId,
        int amount,
        string status,
        CancellationToken cancellationToken)
    {
        if (status is not ("successful" or "failed") ||
            string.IsNullOrWhiteSpace(transId) ||
            amount < 1)
        {
            return false;
        }

        const string sql = """
            UPDATE store_owner_payouts
            SET status = @status,
                fapshi_trans_id = @transId,
                details = NULL,
                updated_at = now()
            WHERE order_id = @orderId
              AND external_id = @externalId
              AND amount_cfa = @amount
              AND (fapshi_trans_id IS NULL OR fapshi_trans_id = @transId)
              AND status IN ('submitting', 'submitted', 'manual_review')
            """;

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("orderId", orderId);
        command.Parameters.AddWithValue("externalId", orderId.ToString("D"));
        command.Parameters.AddWithValue("amount", amount);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("transId", transId);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public async Task<int> ExpireStaleFapshiOrdersAsync(TimeSpan maxAge, CancellationToken cancellationToken)
    {
        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        const string expireSql = """
            UPDATE store_orders
            SET payment_status = 'failed', updated_at = now()
            WHERE id IN (
                SELECT id FROM store_orders
                WHERE payment_method = 'fapshi'
                  AND payment_status = 'pending'
                  AND created_at < now() - @maxAge
                ORDER BY created_at
                LIMIT 200
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id
            """;
        await using var expire = new NpgsqlCommand(expireSql, connection, transaction);
        expire.Parameters.AddWithValue("maxAge", maxAge);
        var expired = new List<Guid>();
        await using (var reader = await expire.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                expired.Add(reader.GetGuid(0));
            }
        }

        foreach (var orderId in expired)
        {
            await RestoreOrderStockAsync(connection, transaction, orderId, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return expired.Count;
    }

    private static async Task RestoreOrderStockAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid orderId,
        CancellationToken cancellationToken)
    {
        const string restoreStockSql = """
            UPDATE store_products p
            SET stock_quantity = p.stock_quantity + i.quantity,
                is_available = true,
                updated_at = now()
            FROM store_order_items i
            WHERE i.order_id = @orderId
              AND p.slug = i.product_slug
            """;
        await using var restoreStock = new NpgsqlCommand(restoreStockSql, connection, transaction);
        restoreStock.Parameters.AddWithValue("orderId", orderId);
        await restoreStock.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<CreateOrderResult> CreateOrderAsync(
        CreateOrderRequestDto request,
        string? customerId,
        string customerName,
        string customerEmail,
        CancellationToken cancellationToken)
    {
        // Lines are grouped by product + size + colour; stock is checked per product.
        var lines = new Dictionary<(string Slug, string Size, string Color), int>();
        foreach (var item in request.Items!)
        {
            var key = (item!.Slug!, item.Size?.Trim() ?? string.Empty, item.Color?.Trim() ?? string.Empty);
            lines[key] = lines.GetValueOrDefault(key) + item.Quantity;
        }

        var quantities = lines
            .GroupBy(line => line.Key.Slug, StringComparer.Ordinal)
            .ToDictionary(group => group.Key, group => group.Sum(line => line.Value), StringComparer.Ordinal);
        if (quantities.Values.Any(quantity => quantity > 50))
        {
            return new CreateOrderResult(
                StatusCodes.Status400BadRequest,
                null,
                "La quantité maximale par article est de 50.");
        }

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var isPickup = string.Equals(request.FulfillmentMethod?.Trim(), "pickup", StringComparison.OrdinalIgnoreCase);
        var zone = isPickup
            ? new DeliveryZoneDto(0, "Retrait en boutique", 0, string.Empty)
            : request.DeliveryZoneId is > 0
                ? await ReadDeliveryZoneAsync(connection, transaction, request.DeliveryZoneId.Value, cancellationToken)
                : null;
        if (zone is null)
        {
            return new CreateOrderResult(
                StatusCodes.Status400BadRequest,
                null,
                "Choisissez une zone de livraison valide.");
        }

        var products = await ReadCheckoutProductsAsync(
            connection,
            transaction,
            quantities.Keys.Order(StringComparer.Ordinal).ToArray(),
            cancellationToken);

        if (products.Count != quantities.Count)
        {
            return new CreateOrderResult(
                StatusCodes.Status409Conflict,
                null,
                "Un article de votre panier n’est plus disponible.");
        }

        var productsBySlug = products.ToDictionary(product => product.Slug, StringComparer.Ordinal);
        foreach (var (slug, quantity) in quantities)
        {
            var product = productsBySlug[slug];
            if (!product.IsActive || !product.IsAvailable || product.StockQuantity < quantity)
            {
                return new CreateOrderResult(
                    StatusCodes.Status409Conflict,
                    null,
                    $"{product.Name} n’est plus disponible dans cette quantité.");
            }
        }

        foreach (var ((slug, size, color), _) in lines)
        {
            var product = productsBySlug[slug];
            if (!IsValidOption(product.Sizes, size))
            {
                return new CreateOrderResult(
                    StatusCodes.Status400BadRequest,
                    null,
                    $"Choisissez une taille disponible pour {product.Name}.");
            }

            if (!IsValidOption(product.Colors, color))
            {
                return new CreateOrderResult(
                    StatusCodes.Status400BadRequest,
                    null,
                    $"Choisissez une couleur disponible pour {product.Name}.");
            }
        }

        var subtotal = lines.Sum(line => (long)productsBySlug[line.Key.Slug].PriceCfa * line.Value);
        var total = subtotal + zone.FeeCfa;
        if (total > int.MaxValue)
        {
            return new CreateOrderResult(
                StatusCodes.Status400BadRequest,
                null,
                "Le montant de la commande est invalide.");
        }

        var accessToken = OrderAccessToken.Create();
        var orderId = await InsertOrderAsync(
            connection,
            transaction,
            customerId,
            customerName,
            customerEmail,
            request,
            isPickup,
            (int)subtotal,
            zone,
            OrderAccessToken.Hash(accessToken),
            cancellationToken);

        foreach (var ((slug, size, color), quantity) in lines)
        {
            await InsertOrderItemAsync(connection, transaction, orderId, productsBySlug[slug], quantity, size, color, cancellationToken);
        }

        foreach (var (slug, quantity) in quantities)
        {
            await DecrementStockAsync(connection, transaction, slug, quantity, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return new CreateOrderResult(StatusCodes.Status201Created, orderId, null, (int)total, accessToken);
    }

    public async Task<OrderStatusDto?> GetOrderStatusAsync(
        Guid orderId,
        string accessToken,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT id, status, payment_status, total_cfa, access_token_hash
            FROM store_orders
            WHERE id = @orderId
            """;
        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("orderId", orderId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken) ||
            reader.IsDBNull(4) ||
            !OrderAccessToken.Matches(accessToken, reader.GetString(4)))
        {
            return null;
        }

        return new OrderStatusDto(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetInt32(3));
    }

    public async Task<IReadOnlyList<DeliveryZoneDto>> GetDeliveryZonesAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT id, name, fee_cfa, delay
            FROM store_delivery_zones
            WHERE is_active = true
            ORDER BY sort_order, name
            """;
        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        var zones = new List<DeliveryZoneDto>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            zones.Add(new DeliveryZoneDto(reader.GetInt64(0), reader.GetString(1), reader.GetInt32(2), reader.GetString(3)));
        }

        return zones;
    }

    private static bool IsValidOption(string[] options, string value) =>
        options.Length == 0 ? value.Length == 0 : options.Contains(value, StringComparer.Ordinal);

    private static async Task<DeliveryZoneDto?> ReadDeliveryZoneAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        long zoneId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT id, name, fee_cfa, delay
            FROM store_delivery_zones
            WHERE id = @id AND is_active = true
            """;
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("id", zoneId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? new DeliveryZoneDto(reader.GetInt64(0), reader.GetString(1), reader.GetInt32(2), reader.GetString(3))
            : null;
    }

    private NpgsqlDataSource GetDataSource() =>
        dataSource ?? throw new InvalidOperationException("ConnectionStrings:Store is not configured.");

    private async Task<List<StoreProductDto>> ReadProductsAsync(string? slug, CancellationToken cancellationToken)
    {
        var slugFilter = slug is null ? string.Empty : " AND p.slug = @slug";
        var sql = """
            SELECT p.slug, p.name, p.price_cfa, p.original_price_cfa, p.image, p.images::text, p.category, p.description,
                   p.sizes::text, p.colors::text, p.stock_quantity,
                   (p.is_available AND p.stock_quantity > 0) AS is_available, p.is_active, p.is_promo,
                   p.seller_name
            FROM store_products p
            WHERE p.is_active = true
              AND EXISTS (
                  SELECT 1 FROM store_categories c
                  WHERE c.name = p.category AND c.is_active = true
              )
            """ + slugFilter + " ORDER BY p.created_at, p.name";

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        if (slug is not null)
        {
            command.Parameters.AddWithValue("slug", slug);
        }

        var products = new List<StoreProductDto>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            products.Add(new StoreProductDto(
                reader.GetString(0),
                reader.GetString(1),
                $"{reader.GetInt32(2).ToString("N0", CultureInfo.GetCultureInfo("fr-FR"))} FCFA",
                reader.IsDBNull(3) ? null : $"{reader.GetInt32(3).ToString("N0", CultureInfo.GetCultureInfo("fr-FR"))} FCFA",
                reader.GetString(4),
                JsonSerializer.Deserialize<string[]>(reader.GetString(5)) ?? [reader.GetString(4)],
                reader.GetString(6),
                reader.GetString(7),
                JsonSerializer.Deserialize<string[]>(reader.GetString(8)) ?? [],
                JsonSerializer.Deserialize<string[]>(reader.GetString(9)) ?? [],
                reader.GetInt32(10),
                reader.GetBoolean(11),
                reader.GetBoolean(12),
                reader.GetBoolean(13),
                reader.GetString(14)));
        }

        return products;
    }

    private static async Task<List<CheckoutProduct>> ReadCheckoutProductsAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string[] slugs,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT slug, name, price_cfa, stock_quantity, is_available, is_active, sizes::text, colors::text
            FROM store_products
            WHERE slug = ANY(@slugs)
            ORDER BY slug
            FOR UPDATE
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("slugs", slugs);
        var products = new List<CheckoutProduct>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            products.Add(new CheckoutProduct(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetInt32(2),
                reader.GetInt32(3),
                reader.GetBoolean(4),
                reader.GetBoolean(5),
                JsonSerializer.Deserialize<string[]>(reader.GetString(6)) ?? [],
                JsonSerializer.Deserialize<string[]>(reader.GetString(7)) ?? []));
        }

        return products;
    }

    private static async Task<Guid> InsertOrderAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string? customerId,
        string customerName,
        string customerEmail,
        CreateOrderRequestDto request,
        bool isPickup,
        int subtotal,
        DeliveryZoneDto zone,
        string accessTokenHash,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO store_orders
                (customer_id, customer_name, customer_email, phone, city, delivery_address, delivery_notes,
                 payment_method, subtotal_cfa, delivery_zone, delivery_fee_cfa, total_cfa, access_token_hash)
            VALUES
                (@customerId, @customerName, @customerEmail, @phone, @city, @deliveryAddress, @deliveryNotes,
                 @paymentMethod, @subtotal, @deliveryZone, @deliveryFee, @total, @accessTokenHash)
            RETURNING id
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("customerId", (object?)customerId ?? DBNull.Value);
        command.Parameters.AddWithValue("customerName", customerName);
        command.Parameters.AddWithValue("customerEmail", customerEmail);
        command.Parameters.AddWithValue("phone", request.Phone!.Trim());
        command.Parameters.AddWithValue("city", isPickup ? "Douala" : request.City!.Trim());
        command.Parameters.AddWithValue("deliveryAddress", isPickup ? "Retrait en boutique" : request.DeliveryAddress!.Trim());
        command.Parameters.AddWithValue("deliveryNotes", isPickup ? string.Empty : request.DeliveryNotes?.Trim() ?? string.Empty);
        command.Parameters.AddWithValue("paymentMethod", request.PaymentMethod!);
        command.Parameters.AddWithValue("subtotal", subtotal);
        command.Parameters.AddWithValue("deliveryZone", zone.Name);
        command.Parameters.AddWithValue("deliveryFee", zone.FeeCfa);
        command.Parameters.AddWithValue("total", subtotal + zone.FeeCfa);
        command.Parameters.AddWithValue("accessTokenHash", accessTokenHash);
        return (Guid)(await command.ExecuteScalarAsync(cancellationToken))!;
    }

    private static async Task InsertOrderItemAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid orderId,
        CheckoutProduct product,
        int quantity,
        string size,
        string color,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO store_order_items
                (order_id, product_slug, product_name, unit_price_cfa, quantity, line_total_cfa, size, color)
            VALUES
                (@orderId, @slug, @name, @price, @quantity, @lineTotal, @size, @color)
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("orderId", orderId);
        command.Parameters.AddWithValue("slug", product.Slug);
        command.Parameters.AddWithValue("name", product.Name);
        command.Parameters.AddWithValue("price", product.PriceCfa);
        command.Parameters.AddWithValue("quantity", quantity);
        command.Parameters.AddWithValue("lineTotal", checked(product.PriceCfa * quantity));
        command.Parameters.AddWithValue("size", size);
        command.Parameters.AddWithValue("color", color);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task DecrementStockAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string slug,
        int quantity,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE store_products
            SET stock_quantity = stock_quantity - @quantity,
                is_available = (stock_quantity - @quantity > 0),
                updated_at = now()
            WHERE slug = @slug
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("quantity", quantity);
        command.Parameters.AddWithValue("slug", slug);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private sealed record CheckoutProduct(
        string Slug,
        string Name,
        int PriceCfa,
        int StockQuantity,
        bool IsAvailable,
        bool IsActive,
        string[] Sizes,
        string[] Colors);
}
