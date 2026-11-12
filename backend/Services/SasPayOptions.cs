namespace EspaceShoppingPlus.Api.Services;

public sealed class SasPayOptions
{
    public const string SectionName = "SasPay";

    public string ApiKey { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
    public string ReturnBaseUrl { get; set; } = string.Empty;
}
