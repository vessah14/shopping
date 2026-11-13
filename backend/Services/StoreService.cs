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
                   o.subtotal_cfa, o.created_at,
                   COALESCE(json_agg(json_build_object(
                       'name', i.product_name, 'quantity', i.quantity, 'lineTotalCfa', i.line_total_cfa
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
                reader.GetString(6),
                DatabaseJsonOptions) ?? [];
            orders.Add(new CustomerOrderDto(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetInt32(4),
                reader.GetDateTime(5),
                items));
        }

        return orders;
    }

    public async Task<bool> SaveSasPayCheckoutSessionAsync(
        Guid orderId,
        string sessionId,
        string checkoutUrl,
        CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE store_orders
            SET saspay_checkout_session_id = @sessionId,
                saspay_checkout_url = @checkoutUrl,
                updated_at = now()
            WHERE id = @orderId
              AND payment_method = 'saspay'
              AND payment_status = 'pending'
              AND saspay_checkout_session_id IS NULL
            """;

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("orderId", orderId);
        command.Parameters.AddWithValue("sessionId", sessionId);
        command.Parameters.AddWithValue("checkoutUrl", checkoutUrl);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public async Task RecordSimulatedSellerPayoutsAsync(Guid orderId, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO store_seller_payouts (order_id, seller_name, destination, amount_cfa)
            SELECT i.order_id,
                   p.seller_name,
                   COALESCE(NULLIF(btrim(p.seller_mobile_money), ''), 'DESTINATION À CONFIGURER'),
                   SUM(i.line_total_cfa)::integer
            FROM store_order_items i
            JOIN store_products p ON p.slug = i.product_slug
            JOIN store_orders o ON o.id = i.order_id
            WHERE i.order_id = @orderId
              AND o.payment_status = 'confirmed'
              AND p.seller_mobile_money IS NOT NULL
              AND btrim(p.seller_mobile_money) <> ''
            GROUP BY i.order_id, p.seller_name, p.seller_mobile_money
            ON CONFLICT (order_id, seller_name, destination) DO NOTHING
            """;
        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("orderId", orderId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> FailSasPayOrderAndRestoreStockAsync(
        Guid orderId,
        CancellationToken cancellationToken)
    {
        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        const string updateOrderSql = """
            UPDATE store_orders
            SET payment_status = 'failed', updated_at = now()
            WHERE id = @orderId
              AND payment_method = 'saspay'
              AND payment_status = 'pending'
              AND saspay_checkout_session_id IS NULL
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

    public async Task<bool> UpdateSasPayPaymentStatusAsync(
        Guid orderId,
        string status,
        decimal amount,
        string currency,
        CancellationToken cancellationToken)
    {
        if (status is not ("confirmed" or "failed") ||
            amount != decimal.Truncate(amount) ||
            amount is < 0 or > int.MaxValue ||
            !string.Equals(currency, "XAF", StringComparison.Ordinal))
        {
            return false;
        }

        const string sql = """
            UPDATE store_orders
            SET payment_status = @status, updated_at = now()
            WHERE id = @orderId
              AND payment_method = 'saspay'
              AND saspay_checkout_session_id IS NOT NULL
              AND subtotal_cfa = @amount
              AND (
                  payment_status = 'pending'
                  OR payment_status = @status
                  OR (@status = 'confirmed' AND payment_status = 'failed')
              )
            """;

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue("orderId", orderId);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("amount", decimal.ToInt32(amount));
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public async Task<CreateOrderResult> CreateOrderAsync(
        CreateOrderRequestDto request,
        string customerId,
        string customerName,
        string customerEmail,
        CancellationToken cancellationToken)
    {
        var quantities = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var item in request.Items!)
        {
            var slug = item!.Slug!;
            quantities[slug] = quantities.GetValueOrDefault(slug) + item.Quantity;
        }

        if (quantities.Values.Any(quantity => quantity > 50))
        {
            return new CreateOrderResult(
                StatusCodes.Status400BadRequest,
                null,
                "La quantité maximale par article est de 50.");
        }

        await using var connection = await GetDataSource().OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
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

        var subtotal = products.Sum(product => (long)product.PriceCfa * quantities[product.Slug]);
        if (subtotal > int.MaxValue)
        {
            return new CreateOrderResult(
                StatusCodes.Status400BadRequest,
                null,
                "Le montant de la commande est invalide.");
        }

        var orderId = await InsertOrderAsync(
            connection,
            transaction,
            customerId,
            customerName,
            customerEmail,
            request,
            (int)subtotal,
            cancellationToken);

        foreach (var product in products)
        {
            var quantity = quantities[product.Slug];
            await InsertOrderItemAsync(connection, transaction, orderId, product, quantity, cancellationToken);
            await DecrementStockAsync(connection, transaction, product.Slug, quantity, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return new CreateOrderResult(StatusCodes.Status201Created, orderId, null, (int)subtotal);
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
            SELECT slug, name, price_cfa, stock_quantity, is_available, is_active
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
                reader.GetBoolean(5)));
        }

        return products;
    }

    private static async Task<Guid> InsertOrderAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        string customerId,
        string customerName,
        string customerEmail,
        CreateOrderRequestDto request,
        int subtotal,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO store_orders
                (customer_id, customer_name, customer_email, phone, city, delivery_address, delivery_notes, payment_method, subtotal_cfa)
            VALUES
                (@customerId, @customerName, @customerEmail, @phone, @city, @deliveryAddress, @deliveryNotes, @paymentMethod, @subtotal)
            RETURNING id
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("customerId", customerId);
        command.Parameters.AddWithValue("customerName", customerName);
        command.Parameters.AddWithValue("customerEmail", customerEmail);
        command.Parameters.AddWithValue("phone", request.Phone!.Trim());
        command.Parameters.AddWithValue("city", request.City!.Trim());
        command.Parameters.AddWithValue("deliveryAddress", request.DeliveryAddress!.Trim());
        command.Parameters.AddWithValue("deliveryNotes", request.DeliveryNotes?.Trim() ?? string.Empty);
        command.Parameters.AddWithValue("paymentMethod", request.PaymentMethod!);
        command.Parameters.AddWithValue("subtotal", subtotal);
        return (Guid)(await command.ExecuteScalarAsync(cancellationToken))!;
    }

    private static async Task InsertOrderItemAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid orderId,
        CheckoutProduct product,
        int quantity,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO store_order_items
                (order_id, product_slug, product_name, unit_price_cfa, quantity, line_total_cfa)
            VALUES
                (@orderId, @slug, @name, @price, @quantity, @lineTotal)
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("orderId", orderId);
        command.Parameters.AddWithValue("slug", product.Slug);
        command.Parameters.AddWithValue("name", product.Name);
        command.Parameters.AddWithValue("price", product.PriceCfa);
        command.Parameters.AddWithValue("quantity", quantity);
        command.Parameters.AddWithValue("lineTotal", checked(product.PriceCfa * quantity));
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
        bool IsActive);
}
