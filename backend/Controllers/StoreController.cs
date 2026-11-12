using System.Text.RegularExpressions;
using EspaceShoppingPlus.Api.DTOs;
using EspaceShoppingPlus.Api.Interfaces;
using EspaceShoppingPlus.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace EspaceShoppingPlus.Api.Controllers;

[ApiController]
[Route("api/store")]
public sealed partial class StoreController(
    IStoreService storeService,
    ISasPayPaymentService sasPayPaymentService,
    IStoreApiKeyValidator apiKeyValidator,
    ILogger<StoreController> logger) : ControllerBase
{
    [HttpGet("products")]
    [ProducesResponseType<StoreCatalogDto>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProducts(CancellationToken cancellationToken)
    {
        if (!storeService.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                detail = "Configure ConnectionStrings:Store to connect the store database.",
            });
        }

        try
        {
            return Ok(await storeService.GetCatalogAsync(cancellationToken));
        }
        catch (NpgsqlException error)
        {
            logger.LogError(error, "Unable to load store products from PostgreSQL.");
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                detail = "The store database is currently unavailable.",
            });
        }
    }

    [HttpGet("products/{slug}")]
    [ProducesResponseType<StoreProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProduct(string slug, CancellationToken cancellationToken)
    {
        if (!storeService.IsConfigured)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                detail = "Configure ConnectionStrings:Store to connect the store database.",
            });
        }

        try
        {
            var product = await storeService.GetProductAsync(slug, cancellationToken);
            return product is null ? NotFound() : Ok(product);
        }
        catch (NpgsqlException error)
        {
            logger.LogError(error, "Unable to load store product {ProductSlug} from PostgreSQL.", slug);
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                detail = "The store database is currently unavailable.",
            });
        }
    }

    [HttpGet("orders")]
    [ProducesResponseType<CustomerOrderDto[]>(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCustomerOrders(CancellationToken cancellationToken)
    {
        if (!IsAuthorized())
        {
            return Unauthorized(new { error = "Unauthorized." });
        }

        var customerId = Request.Headers["X-Customer-Id"].ToString();
        if (string.IsNullOrWhiteSpace(customerId))
        {
            return BadRequest(new { error = "Customer identity is required." });
        }

        if (!storeService.IsConfigured)
        {
            return ServiceUnavailable("The order service is not configured.");
        }

        try
        {
            return Ok(await storeService.GetCustomerOrdersAsync(customerId, cancellationToken));
        }
        catch (NpgsqlException error)
        {
            logger.LogError(error, "Unable to load orders for customer {CustomerId}.", customerId);
            return ServiceUnavailable("Le service de commande est indisponible.");
        }
    }

    [HttpPost("orders")]
    [ProducesResponseType<CreateOrderResponseDto>(StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateOrder(
        [FromBody] CreateOrderRequestDto request,
        CancellationToken cancellationToken)
    {
        if (!IsAuthorized())
        {
            return Unauthorized(new { error = "Unauthorized." });
        }

        var customerId = Request.Headers["X-Customer-Id"].ToString();
        var customerName = request.CustomerName?.Trim() ?? string.Empty;
        var customerEmail = request.CustomerEmail?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(customerId) || customerName.Length is < 1 or > 100 ||
            customerEmail.Length is < 3 or > 254 || !customerEmail.Contains('@'))
        {
            return BadRequest(new { error = "Customer identity is invalid." });
        }

        if (!IsValidOrderRequest(request, out var validationError))
        {
            return BadRequest(new { error = validationError });
        }

        if (!storeService.IsConfigured)
        {
            return ServiceUnavailable("Le service de commande est indisponible.");
        }

        if (request.PaymentMethod == "saspay" && !sasPayPaymentService.IsConfigured)
        {
            return ServiceUnavailable("Le paiement SasPay n’est pas encore configuré.");
        }

        try
        {
            var result = await storeService.CreateOrderAsync(
                request,
                customerId,
                customerName,
                customerEmail,
                cancellationToken);

            if (result.Id is null)
            {
                return StatusCode(result.StatusCode, new { error = result.Error });
            }

            if (request.PaymentMethod == "saspay")
            {
                if (result.SubtotalCfa < 1)
                {
                    await storeService.FailSasPayOrderAndRestoreStockAsync(result.Id.Value, cancellationToken);
                    return BadRequest(new { error = "Le montant de la commande est invalide pour un paiement SasPay." });
                }

                try
                {
                    var checkout = await sasPayPaymentService.CreateCheckoutSessionAsync(
                        result.Id.Value,
                        result.SubtotalCfa,
                        customerEmail,
                        customerName,
                        request.Phone!.Trim(),
                        cancellationToken);
                    if (!await storeService.SaveSasPayCheckoutSessionAsync(
                        result.Id.Value,
                        checkout.Id,
                        checkout.CheckoutUrl,
                        cancellationToken))
                    {
                        logger.LogError("Unable to persist SasPay checkout session for order {OrderId}.", result.Id);
                        await storeService.FailSasPayOrderAndRestoreStockAsync(
                            result.Id.Value,
                            CancellationToken.None);
                        return ServiceUnavailable("La session de paiement a été créée mais ne peut pas être enregistrée.");
                    }

                    return StatusCode(
                        StatusCodes.Status201Created,
                        new CreateOrderResponseDto(result.Id.Value, checkout.CheckoutUrl));
                }
                catch (Exception error) when (error is SasPayException or HttpRequestException or TaskCanceledException)
                {
                    logger.LogError(error, "Unable to start SasPay payment for order {OrderId}.", result.Id);
                    await storeService.FailSasPayOrderAndRestoreStockAsync(
                        result.Id.Value,
                        CancellationToken.None);
                    return ServiceUnavailable("Impossible de démarrer le paiement SasPay. Réessayez votre commande.");
                }
            }

            return StatusCode(
                StatusCodes.Status201Created,
                new CreateOrderResponseDto(result.Id.Value));
        }
        catch (NpgsqlException error)
        {
            logger.LogError(error, "Unable to create an order for customer {CustomerId}.", customerId);
            return ServiceUnavailable("Le service de commande est indisponible.");
        }
    }

    private bool IsAuthorized() =>
        apiKeyValidator.IsValid(Request.Headers["X-Store-Api-Key"].ToString());

    private ObjectResult ServiceUnavailable(string message) =>
        StatusCode(StatusCodes.Status503ServiceUnavailable, new { error = message });

    private static bool IsValidOrderRequest(CreateOrderRequestDto request, out string error)
    {
        if (request.Items is null || request.Items.Length is < 1 or > 40 ||
            request.Items.Any(item =>
                item?.Slug is not { } slug ||
                !ProductSlugRegex().IsMatch(slug) ||
                item.Quantity is < 1 or > 50))
        {
            error = "Votre panier est vide ou contient des quantités invalides.";
            return false;
        }

        var phone = request.Phone?.Trim() ?? string.Empty;
        var city = request.City?.Trim() ?? string.Empty;
        var deliveryAddress = request.DeliveryAddress?.Trim() ?? string.Empty;
        var deliveryNotes = request.DeliveryNotes?.Trim() ?? string.Empty;
        if (!PhoneRegex().IsMatch(phone) || city.Length is < 2 or > 100 ||
            deliveryAddress.Length is < 8 or > 300 || deliveryNotes.Length > 500 ||
        request.PaymentMethod is not ("cash_on_delivery" or "mtn_money" or "orange_money" or "saspay"))
        {
            error = "Vérifiez votre téléphone, ville, adresse et moyen de paiement.";
            return false;
        }

        error = string.Empty;
        return true;
    }

    [GeneratedRegex("^[a-z0-9]+(?:-[a-z0-9]+)*$")]
    private static partial Regex ProductSlugRegex();

    [GeneratedRegex(@"^\+?[0-9\s()-]{8,20}$")]
    private static partial Regex PhoneRegex();
}
