using EspaceShoppingPlus.Api.DTOs;

namespace EspaceShoppingPlus.Api.Interfaces;

public interface IStoreService
{
    bool IsConfigured { get; }

    Task<StoreCatalogDto> GetCatalogAsync(CancellationToken cancellationToken);

    Task<StoreProductDto?> GetProductAsync(string slug, CancellationToken cancellationToken);

    Task<IReadOnlyList<CustomerOrderDto>> GetCustomerOrdersAsync(
        string customerId,
        CancellationToken cancellationToken);

    Task<CreateOrderResult> CreateOrderAsync(
        CreateOrderRequestDto request,
        string? customerId,
        string customerName,
        string customerEmail,
        CancellationToken cancellationToken);

    Task<bool> SaveFapshiCheckoutSessionAsync(
        Guid orderId,
        string transId,
        string checkoutUrl,
        CancellationToken cancellationToken);

    Task<bool> FailFapshiOrderAndRestoreStockAsync(
        Guid orderId,
        CancellationToken cancellationToken);

    Task<FapshiPaymentUpdateResult> UpdateFapshiPaymentStatusAsync(
        Guid orderId,
        string transId,
        string status,
        int amount,
        OwnerPayoutReservation? ownerPayout,
        CancellationToken cancellationToken);

    Task<OwnerPayout?> TryStartOwnerPayoutAsync(Guid orderId, CancellationToken cancellationToken);

    Task<OwnerPayout?> TryStartNextOwnerPayoutAsync(CancellationToken cancellationToken);

    Task<int> FlagStaleOwnerPayoutsAsync(CancellationToken cancellationToken);

    Task<bool> CompleteOwnerPayoutSubmissionAsync(
        Guid orderId,
        string status,
        string? transId,
        string? details,
        CancellationToken cancellationToken);

    Task<bool> UpdateOwnerPayoutStatusAsync(
        Guid orderId,
        string transId,
        int amount,
        string status,
        CancellationToken cancellationToken);

    Task<OrderStatusDto?> GetOrderStatusAsync(Guid orderId, string accessToken, CancellationToken cancellationToken);

    Task<IReadOnlyList<DeliveryZoneDto>> GetDeliveryZonesAsync(CancellationToken cancellationToken);

    Task<int> ExpireStaleFapshiOrdersAsync(TimeSpan maxAge, CancellationToken cancellationToken);
}

public enum FapshiPaymentUpdateResult
{
    Rejected,
    AlreadyProcessed,
    Updated,
}

public sealed record OwnerPayoutReservation(
    int? AmountCfa,
    string? PhoneNumber,
    string BaseUrl,
    bool Enabled,
    bool ConfigurationComplete);

public sealed record OwnerPayout(
    Guid OrderId,
    int AmountCfa,
    string PhoneNumber,
    string ExternalId,
    string UserId,
    string BaseUrl);
