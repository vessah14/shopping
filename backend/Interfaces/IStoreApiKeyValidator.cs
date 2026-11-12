namespace EspaceShoppingPlus.Api.Interfaces;

public interface IStoreApiKeyValidator
{
    bool IsValid(string? suppliedKey);
}
