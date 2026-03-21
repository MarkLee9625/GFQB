---
name: llm-api-integration
description: Integrate LLM APIs (DeepSeek, OpenAI, Gemini). Use when building aiService.ts, writing fetch requests to AI models, or implementing AI prompt logic.
---

# LLM API Integration Guide

When implementing AI model integrations or writing API requests, you must follow these rigorous steps to prevent hallucinations and ensure robust connections.

## 1. Verify API Specs Before Coding
- **DO NOT** guess or hallucinate API request/response formats.
- Always use tools (like browser or execute_command) to search for the latest REST API documentation of the target model.

## 2. Define Strict Interfaces
Before writing the `fetch` logic, define the TypeScript interfaces based on the official documentation (e.g., ChatCompletionRequest, ChatCompletionResponse).

## 3. Robust Error Handling
Wrap all API calls in a `try-catch` block. Ensure the `catch` block logs meaningful business context:
- Correct: `console.error('[aiService] LLM API failed during generation:', error.message);`