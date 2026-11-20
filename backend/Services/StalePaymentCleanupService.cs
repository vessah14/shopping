using EspaceShoppingPlus.Api.Interfaces;
using Microsoft.Extensions.Options;
using Npgsql;

namespace EspaceShoppingPlus.Api.Services;

/// <summary>
/// Periodically releases the stock reserved by SasPay orders that were never paid
/// (customer closed the payment page, no webhook received).
/// </summary>
public sealed class StalePaymentCleanupService(
    IServiceScopeFactory scopeFactory,
    IOptions<SasPayOptions> options,
    ILogger<StalePaymentCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(10);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var maxAge = TimeSpan.FromMinutes(Math.Max(15, options.Value.PendingOrderTimeoutMinutes));
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var storeService = scope.ServiceProvider.GetRequiredService<IStoreService>();
                if (!storeService.IsConfigured)
                {
                    return;
                }

                var expired = await storeService.ExpireStaleSasPayOrdersAsync(maxAge, stoppingToken);
                if (expired > 0)
                {
                    logger.LogInformation("Released stock of {Count} unpaid SasPay order(s).", expired);
                }
            }
            catch (NpgsqlException error)
            {
                logger.LogWarning(error, "Unable to expire unpaid SasPay orders.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
