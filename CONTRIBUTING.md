# Contributing to Calendar & Reminders for Mac

Thank you for your interest in contributing to Calendar & Reminders for Mac! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Style Guide](#style-guide)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Code of Conduct

This project adheres to the Contributor Covenant Code of Conduct. By participating, you are expected to uphold this code. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Set up the development environment (see below)
4. Create a branch for your changes
5. Make your changes
6. Submit a pull request

## Development Setup

### Prerequisites

- macOS 13.0 (Ventura) or later
- [Bun](https://bun.sh) runtime (v1.0.0 or later)
- Xcode Command Line Tools

### Installation

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/mcp-server-eventkit.git
cd mcp-server-eventkit

# Install dependencies
bun install

# Build the Swift bridge
bun run build:swift

# Run in development mode
bun run dev
```

### Running Tests

```bash
# Run all tests
bun test

# Run linting
bun run lint

# Check formatting
bun run format:check

# Type checking
bun run typecheck
```

### Building

```bash
# Build Swift bridge only
bun run build:swift

# Build standalone binary
bun run build:binary

# Build everything
bun run build

# Build installer package
bun run build:pkg
```

## Making Changes

### Branch Naming

Use descriptive branch names:
- `feature/add-calendar-sync`
- `fix/reminder-date-parsing`
- `docs/update-readme`
- `refactor/simplify-ffi-bridge`

### Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(calendar): add event deletion support
fix(reminders): handle null due dates correctly
docs(readme): add installation instructions
```

## Pull Request Process

1. **Update documentation**: If your changes affect the public API, update the README and relevant documentation.

2. **Add tests**: New features should include tests. Bug fixes should include a test that would have caught the bug.

3. **Run checks**: Before submitting, ensure all checks pass:
   ```bash
   bun run lint
   bun run format:check
   bun run typecheck
   bun test
   ```

4. **Update CHANGELOG**: Add an entry to CHANGELOG.md under "Unreleased".

5. **Create PR**: Submit your pull request with a clear description of the changes.

6. **Code review**: Address any feedback from reviewers.

## Style Guide

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public functions
- Follow ESLint and Prettier configurations

### Code Organization

```
src/
├── index.ts              # Entry point
├── server.ts             # Server configuration
├── swift-bridge/         # FFI bridge to Swift
├── tools/                # MCP tool implementations
├── schemas/              # Zod validation schemas
├── prompts/              # MCP prompt templates
└── __tests__/            # Test files
```

### Swift

- Follow Swift API Design Guidelines
- Use `@_cdecl` for FFI exports
- Handle errors gracefully with proper error messages
- Document public functions

## Reporting Bugs

When reporting bugs, please include:

1. **Description**: Clear description of the bug
2. **Steps to reproduce**: Minimal steps to reproduce the issue
3. **Expected behavior**: What you expected to happen
4. **Actual behavior**: What actually happened
5. **Environment**:
   - macOS version
   - Bun version (`bun --version`)
   - How you're running the server (Claude Desktop, CLI, etc.)
6. **Logs**: Any relevant error messages or logs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) when creating issues.

## Requesting Features

Feature requests are welcome! Please:

1. Check existing issues to avoid duplicates
2. Describe the use case and problem you're trying to solve
3. Propose a solution if you have one in mind
4. Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md)

## Questions?

If you have questions about contributing, feel free to:
- Open a discussion on GitHub
- Create an issue with the "question" label

Thank you for contributing!
