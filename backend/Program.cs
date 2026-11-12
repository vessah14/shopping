using EspaceShoppingPlus.Api.Interfaces;
using EspaceShoppingPlus.Api.Services;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

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
builder.Services.AddScoped<IStoreService>(services =>
    new StoreService(services.GetService<NpgsqlDataSource>()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}
else
{
    app.UseHttpsRedirection();
}

app.MapControllers();

app.Run();
