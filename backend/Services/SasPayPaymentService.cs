using System.Globalization;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using EspaceShoppingPlus.Api.Interfaces;
using Microsoft.Extensions.Options;

namespace EspaceShoppingPlus.Api.Services;

public sealed class SasPayPaymentService(
    HttpClient httpClient,
    IOptions<SasPayOptions> options,
    ILogger<SasPayPaymentService> logger) : ISasPayPaymentService
{
    private const string ApiBaseUrl = "https://api.saspay.me/api/v1/";
    private const string CheckoutHost = "pay.saspay.me";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };
    private readonly SasPayOptions settings = options.Value;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(settings.ApiKey) &&
        !string.IsNullOrWhiteSpace(settings.WebhookSecret) &&
        Uri.TryCreate(settings.ReturnBaseUrl, UriKind.Absolute, out var returnUri) &&
        (returnUri.Scheme == Uri.UriSchemeHttps ||
            returnUri.IsLoopback && returnUri.Scheme == Uri.UriSchemeHttp);

    public async Task<SasPayCheckoutSession> CreateCheckoutSessionAsync(
        Guid orderId,
        int amountCfa,
        string customerEmail,
        string customerName,
        string customerPhone,
        string accessToken,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();
        using var request = new HttpRequestMessage(HttpMethod.Post, new Uri(new Uri(ApiBaseUrl), "checkout-sessions/"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ApiKey);
        request.Content = JsonContent.Create(new
        {
            amount = amountCfa.ToString("0.00", CultureInfo.InvariantCulture),
            currency = "XAF",
            country = "CM",
            description = $"Commande #{orderId:D}",
            customer_email = string.IsNullOrWhiteSpace(customerEmail) ? null : customerEmail,
            customer_name = customerName,
            customer_phone = customerPhone,
            return_url = BuildReturnUrl(orderId, accessToken),
            metadata = new { order_id = orderId.ToString("D") },
        }, options: JsonOptions);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadResponseAsync<SasPayCheckoutResponse>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || envelope.Data is null ||
            string.IsNullOrWhiteSpace(envelope.Data.Id) ||
            !Uri.TryCreate(envelope.Data.CheckoutUrl, UriKind.Absolute, out var checkoutUri) ||
            checkoutUri.Scheme != Uri.UriSchemeHttps ||
            !string.Equals(checkoutUri.Host, CheckoutHost, StringComparison.OrdinalIgnoreCase))
        {
            logger.LogWarning("SasPay checkout session creation failed with HTTP {StatusCode}.", (int)response.StatusCode);
            throw new SasPayException("SasPay n’a pas pu créer la session de paiement.");
        }

        return new SasPayCheckoutSession(envelope.Data.Id, checkoutUri.AbsoluteUri);
    }

    public async Task<SasPayPaymentVerification> VerifyPaymentAsync(
        string paymentId,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();
        if (!Guid.TryParse(paymentId, out var parsedPaymentId))
        {
            throw new SasPayException("L’identifiant de transaction SasPay est invalide.");
        }

        using var request = new HttpRequestMessage(
            HttpMethod.Get,
            new Uri(new Uri(ApiBaseUrl), $"payments/{parsedPaymentId:D}/verify/"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", settings.ApiKey);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var envelope = await ReadResponseAsync<SasPayPaymentResponse>(response, cancellationToken);
        var transaction = envelope.Data;
        if (!response.IsSuccessStatusCode || transaction is null ||
            !string.Equals(transaction.Id, parsedPaymentId.ToString("D"), StringComparison.OrdinalIgnoreCase) ||
            !decimal.TryParse(transaction.RequestedAmount, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount))
        {
            logger.LogWarning("SasPay payment verification failed with HTTP {StatusCode}.", (int)response.StatusCode);
            throw new SasPayException("SasPay n’a pas pu vérifier le paiement.");
        }

        return new SasPayPaymentVerification(
            transaction.Id,
            transaction.Status,
            transaction.Description,
            transaction.Currency,
            amount);
    }

    public bool IsValidWebhookSignature(string rawBody, string? signature, string? timestamp)
    {
        if (string.IsNullOrWhiteSpace(settings.WebhookSecret) ||
            string.IsNullOrWhiteSpace(signature) ||
            !long.TryParse(timestamp, NumberStyles.None, CultureInfo.InvariantCulture, out var timestampSeconds))
        {
            return false;
        }

        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        if (timestampSeconds < now - 300 || timestampSeconds > now + 300)
        {
            return false;
        }

        var signedPayload = Encoding.UTF8.GetBytes($"{timestamp}.{rawBody}");
        var expectedSignature = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(settings.WebhookSecret),
            signedPayload);
        if (signature.Length != expectedSignature.Length * 2)
        {
            return false;
        }

        byte[] suppliedSignature;
        try
        {
            suppliedSignature = Convert.FromHexString(signature);
        }
        catch (FormatException)
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(expectedSignature, suppliedSignature);
    }

    private string BuildReturnUrl(Guid orderId, string accessToken)
    {
        var returnUri = new Uri(new Uri(settings.ReturnBaseUrl.TrimEnd('/') + "/"), "paiement/retour");
        return Microsoft.AspNetCore.WebUtilities.QueryHelpers.AddQueryString(
            returnUri.AbsoluteUri,
            new Dictionary<string, string?>
            {
                ["orderId"] = orderId.ToString("D"),
                ["token"] = accessToken,
            });
    }

    private void EnsureConfigured()
    {
        if (!IsConfigured)
        {
            throw new SasPayException("Le paiement SasPay n’est pas configuré.");
        }
    }

    private async Task<SasPayEnvelope<T>> ReadResponseAsync<T>(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        try
        {
            var envelope = await response.Content.ReadFromJsonAsync<SasPayEnvelope<T>>(
                JsonOptions,
                cancellationToken);
            if (envelope is null || !envelope.Success)
            {
                throw new SasPayException("SasPay a refusé la requête de paiement.");
            }

            return envelope;
        }
        catch (JsonException error)
        {
            logger.LogWarning(error, "SasPay returned an invalid response.");
            throw new SasPayException("La réponse de SasPay est invalide.", error);
        }
    }

    private sealed record SasPayEnvelope<T>(bool Success, T? Data);
    private sealed record SasPayCheckoutResponse(
        string Id,
        [property: JsonPropertyName("checkout_url")] string CheckoutUrl);
    private sealed record SasPayPaymentResponse(
        string Id,
        string Status,
        string Description,
        string Currency,
        [property: JsonPropertyName("requested_amount")] string RequestedAmount);
}

public sealed class SasPayException(string message, Exception? innerException = null)
    : Exception(message, innerException);
