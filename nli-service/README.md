---
title: Feynman NLI Service
emoji: 🧠
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Feynman NLI Verification Service

This is the NLI microservice for the Feynman AI System.
It uses **DeBERTa-v3-small** + **all-MiniLM-L6-v2** to verify factual claims.

## Endpoint

`POST /verify`

```json
{
  "original": "The original academic text...",
  "claims": ["claim1", "claim2"]
}
```
