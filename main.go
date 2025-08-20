package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	openai "github.com/sashabaranov/go-openai"
)

type model struct {
	history  []string
	input    textinput.Model
	client   *openai.Client
	messages []openai.ChatCompletionMessage
}

const systemPrompt = "You are a coding agent. Use your expertise to write, read, and modify code."

func initialModel() model {
	ti := textinput.New()
	ti.Placeholder = "Ask or command..."
	ti.Focus()
	client := openai.NewClient(os.Getenv("OPENAI_API_KEY"))
	msgs := []openai.ChatCompletionMessage{{Role: openai.ChatMessageRoleSystem, Content: systemPrompt}}
	return model{input: ti, client: client, messages: msgs, history: []string{"Welcome to the coding agent."}}
}

func (m model) Init() tea.Cmd {
	return textinput.Blink
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.Type {
		case tea.KeyEnter:
			line := strings.TrimSpace(m.input.Value())
			m.history = append(m.history, "> "+line)
			m.input.Reset()
			return m.handleLine(line)
		}
	}
	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	return m, cmd
}

func (m model) handleLine(line string) (tea.Model, tea.Cmd) {
	if line == "" {
		return m, nil
	}
	fields := strings.Fields(line)
	if len(fields) == 0 {
		return m, nil
	}
	switch fields[0] {
	case "read":
		if len(fields) < 2 {
			m.history = append(m.history, "usage: read <file>")
			return m, nil
		}
		data, err := os.ReadFile(fields[1])
		if err != nil {
			m.history = append(m.history, err.Error())
		} else {
			m.history = append(m.history, string(data))
		}
	case "ls":
		dir := "."
		if len(fields) > 1 {
			dir = fields[1]
		}
		entries, err := os.ReadDir(dir)
		if err != nil {
			m.history = append(m.history, err.Error())
		} else {
			names := []string{}
			for _, e := range entries {
				names = append(names, e.Name())
			}
			m.history = append(m.history, strings.Join(names, "\n"))
		}
	case "write":
		if len(fields) < 3 {
			m.history = append(m.history, "usage: write <file> <content>")
			return m, nil
		}
		path := fields[1]
		content := strings.Join(fields[2:], " ")
		err := os.WriteFile(path, []byte(content), 0o644)
		if err != nil {
			m.history = append(m.history, err.Error())
		} else {
			m.history = append(m.history, "wrote to "+path)
		}
	case "update":
		if len(fields) < 3 {
			m.history = append(m.history, "usage: update <file> <content>")
			return m, nil
		}
		path := fields[1]
		content := strings.Join(fields[2:], " ")
		f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
		if err != nil {
			m.history = append(m.history, err.Error())
		} else {
			if _, err := f.WriteString(content); err != nil {
				m.history = append(m.history, err.Error())
			} else {
				m.history = append(m.history, "updated "+path)
			}
			f.Close()
		}
	case "delete":
		if len(fields) < 2 {
			m.history = append(m.history, "usage: delete <path>")
			return m, nil
		}
		err := os.RemoveAll(fields[1])
		if err != nil {
			m.history = append(m.history, err.Error())
		} else {
			m.history = append(m.history, "deleted "+fields[1])
		}
	default:
		m.messages = append(m.messages, openai.ChatCompletionMessage{Role: openai.ChatMessageRoleUser, Content: line})
		resp, err := m.client.CreateChatCompletion(context.Background(), openai.ChatCompletionRequest{
			Model:    openai.GPT3Dot5Turbo,
			Messages: m.messages,
		})
		if err != nil {
			m.history = append(m.history, "error: "+err.Error())
		} else if len(resp.Choices) > 0 {
			reply := resp.Choices[0].Message.Content
			m.history = append(m.history, reply)
			m.messages = append(m.messages, resp.Choices[0].Message)
		}
	}
	return m, nil
}

func (m model) View() string {
	return fmt.Sprintf("%s\n\n%s", strings.Join(m.history, "\n"), m.input.View())
}

func main() {
	p := tea.NewProgram(initialModel())
	if err := p.Start(); err != nil {
		fmt.Println("error:", err)
		os.Exit(1)
	}
}
