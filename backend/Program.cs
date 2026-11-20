using EspaceShoppingPlus.Api.Interfaces;
using EspaceShoppingPlus.Api.Services;
using Microsoft.AspNetCore.HttpOverrides;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
var forwardedHeadersEnabled = builder.Configuration.GetValue<bool>("ForwardedHeaders:Enabled");

if (forwardedHeadersEnabled)
{
    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedProto;
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    });
}

builder.Services.AddOpenApi();
builder.Services.AddControllers();

var storeConnectionString = builder.Configuration.GetConnectionString("Store");
if (!string.IsNullOrWhiteSpace(storeConnectionString))
{
    builder.Services.AddSingleton(NpgsqlDataSource.Create(storeConnectionString));
}

builder.Services.AddSingleton<IStoreApiKeyValidator, StoreApiKeyValidator>();
builder.Services.Configure<SasPayOptions>(
    builder.Configuration.GetSection(SasPayOptions.SectionName));
builder.Services.AddHttpClient<ISasPayPaymentService, SasPayPaymentService>(
    client => client.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddHostedService<StalePaymentCleanupService>();
builder.Services.AddScoped<IStoreService>(services =>
    new StoreService(services.GetService<NpgsqlDataSource>()));

var app = builder.Build();

if (forwardedHeadersEnabled)
{
    app.UseForwardedHeaders();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else if (!forwardedHeadersEnabled)
{
    app.UseHttpsRedirection();
}

app.MapControllers();

app.Run();
