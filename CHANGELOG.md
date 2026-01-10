# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `delete_reminder` tool to permanently delete reminders from Apple Reminders
  - Swift bridge function `ekb_delete_reminder` in EventKitBridge.swift
  - TypeScript wrapper `deleteReminder` in eventkit-bridge.ts
  - MCP tool registration in delete-reminder.ts

## [0.1.2] - 2024-12-19

### Added

- Initial public release
- Reminder management (list, create, complete, update, search)
- Calendar event management (list, create, update, delete)
- Tag support via SQLite database access
- Toggle flag functionality
- Filtered listing with advanced filters
