using System.Text.Json;
using EspaceShoppingPlus.Api.Interfaces;
using EspaceShoppingPlus.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace EspaceShoppingPlus.Api.Controllers;

[ApiController]
[Route("api/webhooks/saspay")]
public sealed class SasPayWebhookController(
    IStoreService storeService,
    ISasPayPaymentService sasPayPaymentService,
    ILogger<SasPayWebhookController> logger) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(64 * 1024)]
    public async Task<IActionResult> Receive(CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body);
        var rawBody = await reader.ReadToEndAsync(cancellationToken);
        if (!sasPayPaymentService.IsValidWebhookSignature(
            rawBody,
            Request.Headers["X-Webhook-Signature"].ToString(),
            Request.Headers["X-Webhook-Timestamp"].ToString()))
        {
            return Unauthorized();
        }

        JsonDocument payload;
        try
        {
            payload = JsonDocument.Parse(rawBody);
        }
        catch (JsonException)
        {
            return BadRequest();
        }

        using (payload)
        {
            var root = payload.RootElement;
            if (!root.TryGetProperty("event", out var eventProperty) ||
                !root.TryGetProperty("data", out var data) ||
                data.ValueKind != JsonValueKind.Object ||
                !data.TryGetProperty("id", out var idProperty) ||
                eventProperty.ValueKind != JsonValueKind.String ||
                idProperty.ValueKind != JsonValueKind.String)
            {
                return BadRequest();
            }

            var eventName = eventProperty.GetString();
            if (eventName is not ("transaction.success" or "transaction.failed" or "transaction.cancelled"))
            {
                return Ok();
            }

            SasPayPaymentVerification verification;
            try
            {
                verification = await sasPayPaymentService.VerifyPaymentAsync(
                    idProperty.GetString()!,
                    cancellationToken);
            }
            catch (SasPayException error)
            {
                logger.LogWarning(error, "Unable to verify SasPay webhook transaction.");
                return StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
            catch (HttpRequestException error)
            {
                logger.LogWarning(error, "SasPay verification service is unavailable.");
                return StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
            catch (TaskCanceledException error) when (!cancellationToken.IsCancellationRequested)
            {
                logger.LogWarning(error, "SasPay verification request timed out.");
                return StatusCode(StatusCodes.Status503ServiceUnavailable);
            }

            if (!TryReadOrderId(verification.Description, out var orderId))
            {
                return Ok();
            }

            var paymentStatus = verification.Status switch
            {
                "SUCCESS" => "confirmed",
                "FAILED" or "CANCELLED" => "failed",
                _ => null,
            };
            if (paymentStatus is null)
            {
                return Ok();
            }

            try
            {
                var updated = await storeService.UpdateSasPayPaymentStatusAsync(
                    orderId,
                    verification.Id,
                    paymentStatus,
                    verification.RequestedAmount,
                    verification.Currency,
                    cancellationToken);
                if (!updated)
                {
                    logger.LogWarning(
                        "SasPay transaction {TransactionId} did not match pending order {OrderId}.",
                        verification.Id,
                        orderId);
                }
                else if (paymentStatus == "confirmed")
                {
                    await storeService.RecordSimulatedSellerPayoutsAsync(orderId, cancellationToken);
                }

                return Ok();
            }
            catch (NpgsqlException error)
            {
                logger.LogError(error, "Unable to update payment status for order {OrderId}.", orderId);
                return StatusCode(StatusCodes.Status503ServiceUnavailable);
            }
        }
    }

    private static bool TryReadOrderId(string description, out Guid orderId)
    {
        const string prefix = "Commande #";
        orderId = Guid.Empty;
        return description.StartsWith(prefix, StringComparison.Ordinal) &&
            Guid.TryParseExact(description[prefix.Length..], "D", out orderId) &&
            string.Equals(
                description,
                $"{prefix}{orderId:D}",
                StringComparison.Ordinal);
    }
}
