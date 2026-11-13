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
        string customerId,
        string customerName,
        string customerEmail,
        CancellationToken cancellationToken);

    Task<bool> SaveSasPayCheckoutSessionAsync(
        Guid orderId,
        string sessionId,
        string checkoutUrl,
        CancellationToken cancellationToken);

    Task<bool> FailSasPayOrderAndRestoreStockAsync(
        Guid orderId,
        CancellationToken cancellationToken);

    Task<bool> UpdateSasPayPaymentStatusAsync(
        Guid orderId,
        string status,
        decimal amount,
        string currency,
        CancellationToken cancellationToken);

    Task RecordSimulatedSellerPayoutsAsync(Guid orderId, CancellationToken cancellationToken);
}
