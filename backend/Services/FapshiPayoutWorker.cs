using EspaceShoppingPlus.Api.Interfaces;
using Microsoft.Extensions.Options;
using Npgsql;

namespace EspaceShoppingPlus.Api.Services;

public sealed class FapshiPayoutWorker(
    IServiceScopeFactory scopeFactory,
    IOptions<FapshiOptions> options,
    ILogger<FapshiPayoutWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            if (!options.Value.Payout.Enabled)
            {
                await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
                continue;
            }

            try
            {
                using var scope = scopeFactory.CreateScope();
                var payoutService = scope.ServiceProvider.GetRequiredService<IFapshiPayoutService>();
                if (!payoutService.IsConfigured)
                {
                    await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
                    continue;
                }

                var storeService = scope.ServiceProvider.GetRequiredService<IStoreService>();
                if (!storeService.IsConfigured)
                {
                    await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
                    continue;
                }

                await storeService.FlagStaleOwnerPayoutsAsync(stoppingToken);
                var payout = await storeService.TryStartNextOwnerPayoutAsync(stoppingToken);
                if (payout is null)
                {
                    await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
                    continue;
                }

                var orchestrator = scope.ServiceProvider.GetRequiredService<FapshiPayoutOrchestrator>();
                await orchestrator.SubmitClaimedPayoutAsync(payout, stoppingToken);
            }
            catch (NpgsqlException error)
            {
                logger.LogError(error, "Unable to process the Fapshi payout queue.");
                await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
            }
        }
    }
}
