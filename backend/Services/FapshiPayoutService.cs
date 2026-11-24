using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using EspaceShoppingPlus.Api.Interfaces;
using Microsoft.Extensions.Options;

namespace EspaceShoppingPlus.Api.Services;

public sealed partial class FapshiPayoutService(
    HttpClient httpClient,
    IOptions<FapshiOptions> options,
    ILogger<FapshiPayoutService> logger) : IFapshiPayoutService
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };
    private readonly FapshiPayoutOptions settings = options.Value.Payout;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(settings.ApiUser) &&
        !string.IsNullOrWhiteSpace(settings.ApiKey) &&
        !string.IsNullOrWhiteSpace(settings.PhoneNumber) &&
        PhoneNumberRegex().IsMatch(settings.PhoneNumber.Trim()) &&
        !string.IsNullOrWhiteSpace(settings.WebhookSecret) &&
        Uri.TryCreate(settings.BaseUrl, UriKind.Absolute, out var baseUri) &&
        baseUri.Scheme == Uri.UriSchemeHttps &&
        IsFapshiHost(baseUri.Host);

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

    public async Task<FapshiPayoutSubmission> SubmitPayoutAsync(
        OwnerPayout payout,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();
        if (!string.Equals(settings.BaseUrl.TrimEnd('/'), payout.BaseUrl.TrimEnd('/'), StringComparison.OrdinalIgnoreCase))
        {
            throw new FapshiPayoutException(
                "L’environnement Fapshi a changé depuis la création du versement; vérification manuelle requise.");
        }

        if (payout.AmountCfa is < 100 or > 500_000 ||
            !PhoneNumberRegex().IsMatch(payout.PhoneNumber))
        {
            throw new FapshiPayoutException("Le montant ou le numéro du décaissement est invalide.");
        }

        using (var balanceRequest = CreateRequest(HttpMethod.Get, "balance"))
        using (var balanceResponse = await httpClient.SendAsync(balanceRequest, cancellationToken))
        {
            var balance = await ReadResponseAsync<FapshiBalanceResponse>(balanceResponse, cancellationToken);
            if (!balanceResponse.IsSuccessStatusCode || balance is null || balance.Balance < payout.AmountCfa)
            {
                logger.LogWarning(
                    "Fapshi payout balance check failed with HTTP {StatusCode}.",
                    (int)balanceResponse.StatusCode);
                throw new FapshiPayoutException("Le solde du service Fapshi de décaissement est insuffisant ou indisponible.");
            }
        }

        using var request = CreateRequest(HttpMethod.Post, "payout");
        request.Content = JsonContent.Create(new
        {
            amount = payout.AmountCfa,
            // Fapshi expects the 9-digit local number and picks the operator (MTN/Orange) from it when medium is omitted.
            phone = Regex.Replace(payout.PhoneNumber, @"^\+?237", ""),
            name = string.IsNullOrWhiteSpace(settings.RecipientName) ? null : settings.RecipientName,
            userId = payout.UserId,
            externalId = payout.ExternalId,
            message = $"Versement commande {payout.OrderId:D}",
        }, options: JsonOptions);

        using var response = await httpClient.SendAsync(request, cancellationToken);
        var result = await ReadResponseAsync<FapshiPayoutResponse>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || result is null || string.IsNullOrWhiteSpace(result.TransId))
        {
            logger.LogWarning("Fapshi payout submission failed with HTTP {StatusCode}.", (int)response.StatusCode);
            throw new FapshiPayoutException("Fapshi n’a pas confirmé la création du décaissement.");
        }

        return new FapshiPayoutSubmission(result.TransId);
    }

    public async Task<FapshiPayoutVerification> VerifyPayoutAsync(
        string transId,
        CancellationToken cancellationToken)
    {
        EnsureConfigured();
        if (!TransactionIdRegex().IsMatch(transId))
        {
            throw new FapshiPayoutException("L’identifiant de transaction Fapshi est invalide.");
        }

        using var request = CreateRequest(HttpMethod.Get, $"payment-status/{transId}");
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var transaction = await ReadResponseAsync<FapshiTransactionResponse>(response, cancellationToken);
        if (!response.IsSuccessStatusCode || transaction is null ||
            !string.Equals(transaction.TransId, transId, StringComparison.Ordinal))
        {
            logger.LogWarning("Fapshi payout verification failed with HTTP {StatusCode}.", (int)response.StatusCode);
            throw new FapshiPayoutException("Fapshi n’a pas pu vérifier le décaissement.");
        }

        return new FapshiPayoutVerification(
            transaction.TransId,
            transaction.Status,
            transaction.ExternalId,
            transaction.Amount,
            transaction.TransType);
    }

    private HttpRequestMessage CreateRequest(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, new Uri(new Uri(settings.BaseUrl.TrimEnd('/') + "/"), path));
        request.Headers.Add("apiuser", settings.ApiUser);
        request.Headers.Add("apikey", settings.ApiKey);
        return request;
    }

    private void EnsureConfigured()
    {
        if (!IsConfigured)
        {
            throw new FapshiPayoutException("Le service Fapshi de décaissement n’est pas configuré.");
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
            logger.LogWarning(error, "Fapshi returned an invalid payout response.");
            throw new FapshiPayoutException("La réponse de décaissement Fapshi est invalide.", error);
        }
    }

    private static bool IsFapshiHost(string host) =>
        host.Equals("fapshi.com", StringComparison.OrdinalIgnoreCase) ||
        host.EndsWith(".fapshi.com", StringComparison.OrdinalIgnoreCase);

    [GeneratedRegex(@"^\+?[0-9]{9,15}$")]
    private static partial Regex PhoneNumberRegex();

    [GeneratedRegex("^[A-Za-z0-9_-]{1,100}$")]
    private static partial Regex TransactionIdRegex();

    private sealed record FapshiBalanceResponse(int Balance);
    private sealed record FapshiPayoutResponse(string? TransId);
    private sealed record FapshiTransactionResponse(
        string TransId,
        string Status,
        string? ExternalId,
        int Amount,
        string? TransType);
}

public sealed class FapshiPayoutException(string message, Exception? innerException = null)
    : Exception(message, innerException);
