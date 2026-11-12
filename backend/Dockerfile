FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend.csproj ./
RUN dotnet restore backend.csproj
COPY . .
RUN dotnet publish backend.csproj --configuration Release --output /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish ./

EXPOSE 8080
CMD ["sh", "-c", "exec dotnet backend.dll --urls http://0.0.0.0:${PORT:-8080}"]