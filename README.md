# Osmia

A stateless, AI-powered CLI tool for data enrichment. **Unix philosophy: File-In ➔ File-Out**.

## Overview

Osmia takes raw JSON/JSONL data, enriches it via web search + LLM, and outputs enhanced data without introducing a database or backend.

```bash
cat input.json | npx osmia-ai --config config.yaml > enriched.json
```

## Features

- **Stateless**: Pure data transformation, no persistent state
- **Unix Pipes**: Native stdin/stdout support
- **Resilient**: Retries with backoff and `429` handling for search and LLM calls
- **Concurrent**: Configurable workers with separate throttles for search and LLM
- **Smart Skip**: Skip already-enriched records (--skip-if-exists)
- **Configurable**: YAML config with templated search queries
- **JSONL Support**: Works with JSONL input and output formats

## Installation

```bash
npm install -g osmia-ai
# or use directly
npx osmia-ai --config config.yaml --input data.json --output enriched.json
```

## Quick Start

1. **Create `config.yaml`**
   ```bash
   osmia-ai init
   ```
   The new wizard asks for your LLM settings, search template, extraction prompt, and schema fields, then writes a valid YAML config for you.

2. **Set API key**:
   ```bash
  export OLLAMA_API_KEY="your-ollama-cloud-api-key"
   ```

3. **Run**:
   ```bash
   osmia-ai --config config.yaml --input data.json --output enriched.json
   ```

## Usage

```
Usage: osmia-ai [options]

Options:
  -c, --config <path>            YAML configuration file
  -i, --input <path>             Input JSON/JSONL file (reads stdin if not provided)
  -o, --output <path>           Output file (writes stdout if not provided)
  -s, --skip-if-exists <fields>  Comma-separated fields to skip if non-empty
  -w, --workers <n>             Concurrent workers (default: 1)
  --dry-run                     Simulate without LLM calls
  --wizard [path]               Launch an interactive wizard and create a YAML config file
  -v, --verbose                 Verbosity (use -v or -vv)
```

Create a config interactively:

```bash
osmia-ai init
# or
osmia-ai --wizard config.yaml
```

## Examples

### Basic Usage

```bash
osmia-ai --config config.yaml --input data.json --output enriched.json
```

### Generate Config Interactively

```bash
osmia-ai init config.yaml
```

### Unix Pipe

```bash
cat data.json | osmia-ai --config config.yaml > enriched.json
```

### With Skip Logic

```bash
osmia-ai -c config.yaml -i data.json -o enriched.json -s category,description,specs
```

### Concurrent Processing

```bash
osmia-ai --config config.yaml --input data.json --workers 5 --verbose
```

### Dry Run (Debug Prompts)

```bash
osmia-ai --config config.yaml --input data.json --dry-run -vv
```

## Configuration

```yaml
llm:
  model: "kimi-k2.5"
  apiUrl: "https://ollama.com/api/chat"
  maxRetries: 3
  requestsPerMinute: 30
  maxConcurrency: 1

research:
  searchQuery: "Product {name} {sku} specifications overview"
  maxResults: 5
  region: "de-de"
  timeoutMs: 10000
  maxRetries: 3
  requestsPerMinute: 30
  maxConcurrency: 1

extraction:
  prompt: |
    Extract category, short description, and notable specifications from web results.
    Respond ONLY in JSON format.
  schema:
    category: string
    description: string
    specs: string
```

**Templating**: Use `{fieldName}` placeholders in `searchQuery`—they're replaced from input records.

The repository also includes a current template at [config.yaml.template](config.yaml.template), but `osmia-ai init` is the fastest way to generate a valid config for a new project.

## Use Cases

- **E-commerce**: Enrich product catalogs with specs and descriptions
- **Research**: Augment datasets with web metadata
- **Content**: Generate summaries, tags, categorizations
- **Contacts**: Enrich contact lists with company info

## Development

```bash
npm install
npm run build
npm test
```

Both `camelCase` and legacy `snake_case` config keys are accepted when loading YAML files.

Runs abort before writing output if any record fails, so batch jobs do not silently leave behind partial result files.

For large batches, start conservatively with `--workers 2` or `--workers 3` and increase `requestsPerMinute` only after confirming that both your search provider and LLM endpoint accept the traffic without returning `429` responses.

## License

MIT
