# Basic Agent

A minimal interactive CLI agent built with [Bubble Tea](https://github.com/charmbracelet/bubbletea) and the [OpenAI Go SDK](https://github.com/sashabaranov/go-openai).

## Features

- Chat with the OpenAI API using a system prompt tailored for coding assistance.
- File system tools:
  - `read <file>` – display a file's contents.
  - `ls [dir]` – list directory contents.
  - `write <file> <content>` – create or overwrite a file.
  - `update <file> <content>` – append content to a file.
  - `delete <path>` – remove files or directories.

## Usage

1. Set your `OPENAI_API_KEY` environment variable.
2. Run the program:
   ```bash
   go run main.go
   ```
3. Type commands or questions and press **Enter**.

