using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using EspaceShoppingPlus.Api.Interfaces;
using Microsoft.Extensions.Options;

namespace EspaceShoppingPlus.Api.Services;

public sealed partial class FapshiPaymentService(
    HttpClient httpClient,
    IOptions<FapshiOptions> options,
    ILogger<FapshiPaymentService> logger) : IFapshiPaymentService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };
    private readonly FapshiOptions settings = options.Value;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(settings.ApiUser) &&
        !string.IsNullOrWhiteSpace(settings.ApiKey) &&
        !string.IsNullOrWhiteSpace(settings.WebhookSecret) &&
        Uri.TryCreate(settings.BaseUrl, UriKind.Absolute, out var baseUri) &&
        baseUri.Scheme == Uri.UriSchemeHttps &&
        IsFapshiHost(baseUri.Host) &&
        Uri.TryCreate(settings.ReturnBaseUrl, UriKind.Absolute, out var returnUri) &&
        (returnUri.Scheme == Uri.UriSchemeHttps ||
            returnUri.IsLoopback && returnUri.Scheme == Uri.UriSchemeHttp);

    public async Task<FapshiCheckoutSession> CreateCheckoutSessionAsync(
        Guid orderId,
        int amountCfa,
        string customerEmail,
        string accessToken,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();
        using var request = CreateRequest(HttpMethod.Post, "initiate-pay");
        request.Content = JsonContent.Create(new
        {
            amount = amountCfa,
            email = string.IsNullOrWhiteSpace(customerEmail) ? null : customerEmail,
            redirectUrl = BuildReturnUrl(orderId, accessToken),
            externalId = orderId.ToString("D"),
            message = $"Commande #{orderId:D}",
        }, options: JsonOptions);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var body = await ReadResponseAsync<FapshiInitiateResponse>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || body is null ||
            string.IsNullOrWhiteSpace(body.TransId) ||
            !Uri.TryCreate(body.Link, UriKind.Absolute, out var checkoutUri) ||
            checkoutUri.Scheme != Uri.UriSchemeHttps ||
            !IsFapshiHost(checkoutUri.Host))
        {
            logger.LogWarning("Fapshi initiate-pay failed with HTTP {StatusCode}.", (int)response.StatusCode);
            throw new FapshiException("Fapshi n’a pas pu créer la session de paiement.");
        }

        return new FapshiCheckoutSession(body.TransId, checkoutUri.AbsoluteUri);
    }

    public async Task<FapshiPaymentVerification> VerifyPaymentAsync(
        string transId,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();
        if (!TransIdRegex().IsMatch(transId))
        {
            throw new FapshiException("L’identifiant de transaction Fapshi est invalide.");
        }

        using var request = CreateRequest(HttpMethod.Get, $"payment-status/{transId}");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var transaction = await ReadResponseAsync<FapshiTransactionResponse>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || transaction is null ||
            !string.Equals(transaction.TransId, transId, StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(transaction.Status))
        {
            logger.LogWarning("Fapshi payment verification failed with HTTP {StatusCode}.", (int)response.StatusCode);
            throw new FapshiException("Fapshi n’a pas pu vérifier le paiement.");
        }

        return new FapshiPaymentVerification(
            transaction.TransId,
            transaction.Status,
            transaction.ExternalId,
            transaction.Amount,
            transaction.Revenue);
    }

    public bool IsValidWebhookSecret(string? secret)
    {
        if (string.IsNullOrWhiteSpace(settings.WebhookSecret) || string.IsNullOrEmpty(secret))
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(settings.WebhookSecret),
            Encoding.UTF8.GetBytes(secret));
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, new Uri(new Uri(settings.BaseUrl.TrimEnd('/') + "/"), path));
        request.Headers.Add("apiuser", settings.ApiUser);
        request.Headers.Add("apikey", settings.ApiKey);
        return request;
    }

    private static bool IsFapshiHost(string host) =>
        host.Equals("fapshi.com", StringComparison.OrdinalIgnoreCase) ||
        host.EndsWith(".fapshi.com", StringComparison.OrdinalIgnoreCase);

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
            throw new FapshiException("Le paiement Fapshi n’est pas configuré.");
        }
    }

    private async Task<T?> ReadResponseAsync<T>(
        HttpResponseMessage response,
        CancellationToken cancellationToken)
    {
        try
        {
            return await response.Content.ReadFromJsonAsync<T>(JsonOptions, cancellationToken);
        }
        catch (JsonException error)
        {
            logger.LogWarning(error, "Fapshi returned an invalid response.");
            throw new FapshiException("La réponse de Fapshi est invalide.", error);
        }
    }

    [GeneratedRegex("^[A-Za-z0-9_-]{1,100}$")]
    private static partial Regex TransIdRegex();

    private sealed record FapshiInitiateResponse(string? Link, string? TransId);
    private sealed record FapshiTransactionResponse(
        string TransId,
        string Status,
        string? ExternalId,
        int Amount,
        int? Revenue);
}

public sealed class FapshiException(string message, Exception? innerException = null)
    : Exception(message, innerException);
