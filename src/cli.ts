#!/usr/bin/env node

import { Command } from "commander";
import { stderr } from "node:process";
import { runPipeline } from "./pipeline.js";

interface CliOptions {
  config: string;
  input?: string;
  output?: string;
  skipIfExists?: string;
  workers: number;
  dryRun: boolean;
  verbose: number;
}

function parseSkipFields(skipIfExists: string | undefined): string[] {
  if (!skipIfExists) {
    return [];
  }

  return skipIfExists
    .split(",")
    .map((field) => field.trim())
    .filter(Boolean);
}

function buildCommand(): Command {
  return new Command()
    .name("osmia")
    .description("AI-powered data enrichment CLI tool")
    .version("0.1.0")
    .requiredOption("-c, --config <path>", "Path to YAML configuration file")
    .option(
      "-i, --input <path>",
      "Path to input JSON/JSONL file (optional, reads stdin if not provided)"
    )
    .option(
      "-o, --output <path>",
      "Path to output JSON/JSONL file (optional, writes to stdout if not provided)"
    )
    .option(
      "-s, --skip-if-exists <fields>",
      "Comma-separated fields to skip when they already contain values"
    )
    .option(
      "-w, --workers <n>",
      "Number of concurrent workers",
      (value) => {
        const workers = Number.parseInt(value, 10);
        if (!Number.isInteger(workers) || workers < 1) {
          throw new Error("Workers must be a positive integer");
        }
        return workers;
      },
      1
    )
    .option("--dry-run", "Simulate processing without making LLM calls", false)
    .option(
      "-v, --verbose",
      "Increase verbosity (repeat for more detail)",
      (_value, previous: number) => previous + 1,
      0
    );
}

export async function run(argv: string[] = process.argv): Promise<void> {
  const cli = buildCommand();

  try {
    cli.parse(argv);
    const options = cli.opts<CliOptions>();

    const pipelineOptions = {
      config: options.config,
      skipFields: parseSkipFields(options.skipIfExists),
      workers: options.workers,
      dryRun: options.dryRun,
      verbose: options.verbose,
      ...(options.input ? { inputPath: options.input } : {}),
      ...(options.output ? { outputPath: options.output } : {}),
    };

    await runPipeline(pipelineOptions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const exitCode =
      typeof (error as { exitCode?: unknown }).exitCode === "number"
        ? ((error as { exitCode: number }).exitCode)
        : 1;

    stderr.write(`Error: ${message}\n`);
    process.exitCode = exitCode;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void run();
}
