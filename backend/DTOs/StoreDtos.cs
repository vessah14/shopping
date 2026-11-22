namespace EspaceShoppingPlus.Api.DTOs;

public sealed record StoreProductDto(
    string Slug,
    string Name,
    string Price,
    string? OriginalPrice,
    string Image,
    string[] Images,
    string Category,
    string Description,
    string[] Sizes,
    string[] Colors,
    int StockQuantity,
    bool IsAvailable,
    bool Active,
    bool IsPromo = false,
    string SellerName = "Espace Shopping Plus",
    string ProductType = "single_piece");

public sealed record StoreCategoryDto(
    string Name,
    string Slug,
    string Image,
    bool Active,
    bool Featured,
    int SortOrder);

public sealed record StoreCatalogDto(
    IReadOnlyList<StoreProductDto> Products,
    IReadOnlyList<StoreCategoryDto> Categories);

public sealed class CreateOrderRequestDto
{
    public CheckoutLineDto?[]? Items { get; init; }
    public string? Phone { get; init; }
    public string? City { get; init; }
    public string? DeliveryAddress { get; init; }
    public string? DeliveryNotes { get; init; }
    public string? FulfillmentMethod { get; init; }
    public long? DeliveryZoneId { get; init; }
    public string? PaymentMethod { get; init; }
    public string? CustomerName { get; init; }
    public string? CustomerEmail { get; init; }
}

public sealed class CheckoutLineDto
{
    public string? Slug { get; init; }
    public int Quantity { get; init; }
    public string? Size { get; init; }
    public string? Color { get; init; }
}

public sealed record CreateOrderResponseDto(Guid Id, string AccessToken, string? CheckoutUrl = null);

public sealed record CreateOrderResult(
    int StatusCode,
    Guid? Id,
    string? Error,
    int TotalCfa = 0,
    string AccessToken = "");

public sealed record CustomerOrderDto(
    Guid Id,
    string Status,
    string PaymentMethod,
    string PaymentStatus,
    int SubtotalCfa,
    int DeliveryFeeCfa,
    int TotalCfa,
    string? DeliveryZone,
    DateTime CreatedAt,
    IReadOnlyList<CustomerOrderItemDto> Items);

public sealed record CustomerOrderItemDto(string Name, int Quantity, int LineTotalCfa, string Size = "", string Color = "");

public sealed record OrderStatusDto(Guid Id, string Status, string PaymentStatus, int TotalCfa);

public sealed record DeliveryZoneDto(long Id, string Name, int FeeCfa, string Delay);
