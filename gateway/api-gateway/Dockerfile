# Built from the repository root (see infra/docker-compose.yml), since the
# gateway depends on the shared libs/Delivery.Common project.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /repo
COPY Directory.Build.props global.json ./
COPY libs/Delivery.Common/ libs/Delivery.Common/
COPY gateway/api-gateway/openapi.yaml gateway/api-gateway/
COPY gateway/api-gateway/src/ gateway/api-gateway/src/
RUN dotnet publish gateway/api-gateway/src -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app ./
EXPOSE 3000
ENTRYPOINT ["dotnet", "ApiGateway.dll"]
