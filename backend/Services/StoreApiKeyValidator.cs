using System.Security.Cryptography;
using System.Text;
using EspaceShoppingPlus.Api.Interfaces;

namespace EspaceShoppingPlus.Api.Services;

public sealed class StoreApiKeyValidator(IConfiguration configuration) : IStoreApiKeyValidator
{
    public bool IsValid(string? suppliedKey)
    {
        var configuredKey = configuration["StoreApi:Key"];
        if (string.IsNullOrEmpty(configuredKey) || string.IsNullOrEmpty(suppliedKey))
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(configuredKey),
            Encoding.UTF8.GetBytes(suppliedKey));
    }
}
