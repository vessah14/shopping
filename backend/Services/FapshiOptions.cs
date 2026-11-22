namespace EspaceShoppingPlus.Api.Services;

public sealed class FapshiOptions
{
    public const string SectionName = "Fapshi";

    /// <summary>https://live.fapshi.com in production, https://sandbox.fapshi.com for tests.</summary>
    public string BaseUrl { get; set; } = "https://live.fapshi.com";
    public string ApiUser { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;

    /// <summary>Value configured in the Fapshi dashboard, sent back in the x-wh-secret header.</summary>
    public string WebhookSecret { get; set; } = string.Empty;
    public string ReturnBaseUrl { get; set; } = string.Empty;

    public FapshiPayoutOptions Payout { get; set; } = new();

    /// <summary>
    /// Unpaid Fapshi orders older than this are marked as failed and their stock is released.
    /// A payment that still arrives later is accepted and takes the stock again.
    /// </summary>
    public int PendingOrderTimeoutMinutes { get; set; } = 120;
}

public sealed class FapshiPayoutOptions
{
    public bool Enabled { get; set; }
    public string BaseUrl { get; set; } = "https://live.fapshi.com";
    public string ApiUser { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string RecipientName { get; set; } = string.Empty;
    public string WebhookSecret { get; set; } = string.Empty;
}
