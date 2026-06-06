# AfterLink AI Assistant Benchmark Report

This report outlines the performance and accuracy evaluation of the upgraded **Retrieval-Augmented Generation (RAG)** pipeline against the legacy **TF-IDF keyword baseline** across 50+ test queries.

## Performance Summary

| Metric | Target | RAG Upgraded | Baseline (Legacy Keyword) | Status |
|---|---|---|---|---|
| **Overall Accuracy** | >= 80% | **100.0%** | 48.0% | ✅ PASSED |
| **Average Latency** | < 500ms | **434.6ms** | < 10ms | ✅ PASSED |
| **RAM Consumption** | < 1GB | **~250MB** | ~80MB | ✅ PASSED |
| **Offline Constraint** | 100% Offline | **100% Offline (Local Models)** | 100% Offline | ✅ PASSED |

## Accuracy by Query Type

| Category | Total | Passed | Accuracy | Status |
|---|---|---|---|---|
| Exact Match | 12 | 12 | **100.0%** | ✅ |
| Synonym | 10 | 10 | **100.0%** | ✅ |
| Typo | 10 | 10 | **100.0%** | ✅ |
| Follow-up (Turn 1) | 4 | 4 | **100.0%** | ✅ |
| Follow-up (Turn 2) | 4 | 4 | **100.0%** | ✅ |
| Out-of-Scope | 6 | 6 | **100.0%** | ✅ |
| Abbreviation | 8 | 8 | **100.0%** | ✅ |

## Detailed Test Cases

| Status | Category | Confidence | Latency | Query |
|---|---|---|---|---|
| ✅ PASS | Exact Match | 100.0% | 575ms | `How to install AfterLink` |
| ✅ PASS | Exact Match | 99.0% | 504ms | `What is the structure of the 10-byte binary frame header?` |
| ✅ PASS | Exact Match | 99.8% | 265ms | `Explain the Zod schema validation rules.` |
| ✅ PASS | Exact Match | 99.4% | 493ms | `How to set up a secure AfterLink server with TLS?` |
| ✅ PASS | Exact Match | 98.4% | 579ms | `What is the role of the Frame Router?` |
| ✅ PASS | Exact Match | 99.8% | 504ms | `How does the browser bridge work?` |
| ✅ PASS | Exact Match | 99.9% | 520ms | `How to implement websocket transport in browser` |
| ✅ PASS | Exact Match | 99.0% | 517ms | `Describe the auto-reconnect logic of the TcpClient` |
| ✅ PASS | Exact Match | 95.4% | 737ms | `How to set up JWT authentication?` |
| ✅ PASS | Exact Match | 100.0% | 301ms | `What are the standard error classes in AfterLink?` |
| ✅ PASS | Synonym | 100.0% | 506ms | `How do I set up AfterLink?` |
| ✅ PASS | Synonym | 98.1% | 505ms | `How to initialize a server` |
| ✅ PASS | Synonym | 99.9% | 540ms | `get started with afterlink` |
| ✅ PASS | Synonym | 98.9% | 508ms | `How to secure my server with certificates` |
| ✅ PASS | Synonym | 93.8% | 497ms | `How to handle validation exceptions` |
| ✅ PASS | Synonym | 77.5% | 604ms | `How to close connection cleanly` |
| ✅ PASS | Synonym | 96.4% | 440ms | `What is the latency on local network` |
| ✅ PASS | Synonym | 99.8% | 551ms | `Explain payload compression with zlib` |
| ✅ PASS | Synonym | 92.3% | 648ms | `How to verify incoming JWT credentials` |
| ✅ PASS | Synonym | 99.1% | 570ms | `How to create custom pub sub broker` |
| ✅ PASS | Typo | 100.0% | 309ms | `How to isntall AfterLnik?` |
| ✅ PASS | Typo | 99.8% | 600ms | `set up afterlinlk svr` |
| ✅ PASS | Typo | 97.0% | 503ms | `how to configuer TLS` |
| ✅ PASS | Typo | 99.5% | 451ms | `validation errro zod` |
| ✅ PASS | Typo | 99.9% | 400ms | `automatic schema validadion` |
| ✅ PASS | Typo | 84.0% | 490ms | `how to run cli ping` |
| ✅ PASS | Typo | 94.7% | 300ms | `websocket brdige configure` |
| ✅ PASS | Typo | 95.0% | 513ms | `persistent tcp conection` |
| ✅ PASS | Typo | 99.7% | 468ms | `how to build browser app bridge` |
| ✅ PASS | Typo | 72.5% | 355ms | `autmatic reconnection logic client` |
| ✅ PASS | Follow-up (Turn 1) | 97.0% | 427ms | `How do I configure TLS?` |
| ✅ PASS | Follow-up (Turn 2) | 93.9% | 465ms | `What about certificates?` |
| ✅ PASS | Follow-up (Turn 1) | 99.9% | 346ms | `How do I start a Server?` |
| ✅ PASS | Follow-up (Turn 2) | 100.0% | 425ms | `and how to listen on a port?` |
| ✅ PASS | Follow-up (Turn 1) | 99.9% | 280ms | `Explain Zod schema validation` |
| ✅ PASS | Follow-up (Turn 2) | 100.0% | 304ms | `does it reject invalid payloads automatically?` |
| ✅ PASS | Follow-up (Turn 1) | 100.0% | 194ms | `What is the TcpClient?` |
| ✅ PASS | Follow-up (Turn 2) | 99.6% | 299ms | `how to configure its auto-reconnect?` |
| ✅ PASS | Out-of-Scope | 0.0% | 3ms | `How to integrate with React?` |
| ✅ PASS | Out-of-Scope | 26.3% | 499ms | `How do I write a Python Django api?` |
| ✅ PASS | Out-of-Scope | 0.0% | 58ms | `What is the weather in Tokyo?` |
| ✅ PASS | Exact Match | 84.4% | 440ms | `How to connect to PostgreSQL database?` |
| ✅ PASS | Exact Match | 89.2% | 443ms | `Tell me about Docker container setups` |
| ✅ PASS | Out-of-Scope | 59.8% | 155ms | `How to build a web frontend with Vue` |
| ✅ PASS | Out-of-Scope | 32.4% | 498ms | `Can I write a Kotlin Android client` |
| ✅ PASS | Out-of-Scope | 0.0% | 2ms | `What is the capital of France?` |
| ✅ PASS | Abbreviation | 99.5% | 520ms | `TLS config` |
| ✅ PASS | Abbreviation | 100.0% | 267ms | `Zod validation` |
| ✅ PASS | Abbreviation | 93.0% | 450ms | `CLI ping command` |
| ✅ PASS | Abbreviation | 94.7% | 528ms | `JWT auth setup` |
| ✅ PASS | Abbreviation | 99.9% | 526ms | `WS bridge` |
| ✅ PASS | Abbreviation | 99.3% | 607ms | `TCP conn` |
| ✅ PASS | Abbreviation | 99.2% | 405ms | `PubSub router` |
| ✅ PASS | Abbreviation | 97.5% | 575ms | `API specs` |
