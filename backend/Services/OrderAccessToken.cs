using System.Security.Cryptography;
using System.Text;

namespace EspaceShoppingPlus.Api.Services;

/// <summary>
/// Secret token given to the buyer to follow an order without an account. Only its
/// SHA-256 hash is stored in the database.
/// </summary>
public static class OrderAccessToken
{
    public static string Create() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

    public static string Hash(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))).ToLowerInvariant();

    public static bool Matches(string token, string expectedHash)
    {
        if (string.IsNullOrEmpty(token) || token.Length > 100)
        {
            return false;
        }

        var actual = Encoding.ASCII.GetBytes(Hash(token));
        var expected = Encoding.ASCII.GetBytes(expectedHash);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }
}
