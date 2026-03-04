# BewareOfDog

REST API Debugger - An Electron application for debugging REST APIs.

## Features

- **Request Builder**: Method selector, URL bar, route params, query params, headers, body
- **Response View**: Status, timing, body (JSON/text), headers
- **Collections**: JSON collection format, import/export, CRUD
- **Variables**: Environment variables and collection variables with `{{var}}` interpolation
- **Environments**: Named sets of variables (Dev, Staging, Prod)
- **Keyboard shortcut**: Ctrl+Enter to send request
- **Theme**: Dark/light mode toggle

## Quick Start

```bash
npm install
npm run dev
```

## Collection Format

```json
{
  "name": "My API",
  "variables": [
    { "key": "baseUrl", "value": "https://api.example.com" }
  ],
  "requests": [
    {
      "id": "uuid",
      "name": "Get User",
      "method": "GET",
      "url": "{{baseUrl}}/users/:userId",
      "routeParams": [{ "key": "userId", "value": "123" }],
      "queryParams": [{ "key": "include", "value": "profile" }],
      "headers": [],
      "body": null
    }
  ]
}
```

## Environment Format

```json
{
  "name": "Development",
  "variables": [
    { "key": "baseUrl", "value": "http://localhost:3000" }
  ]
}
```

## Build

```bash
npm run build
```
