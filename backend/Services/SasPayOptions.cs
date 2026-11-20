namespace EspaceShoppingPlus.Api.Services;

public sealed class SasPayOptions
{
    public const string SectionName = "SasPay";

    public string ApiKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string ReturnBaseUrl { get; set; } = string.Empty;

    /// <summary>
    /// Unpaid SasPay orders older than this are marked as failed and their stock is released.
    /// A payment that still arrives later is accepted and takes the stock again.
    /// </summary>
    public int PendingOrderTimeoutMinutes { get; set; } = 120;
}
