# ARIA for Neovim

Syntax highlighting, file type detection, and MCP integration for `.aria` specification files.

## Installation

### Option A: Manual (copy files)

```bash
# From the ARIA repository root:
mkdir -p ~/.config/nvim/syntax ~/.config/nvim/ftdetect

cp editors/neovim/syntax/aria.vim ~/.config/nvim/syntax/
cp editors/neovim/ftdetect/aria.vim ~/.config/nvim/ftdetect/
```

### Option B: lazy.nvim (as a local plugin)

```lua
-- In your lazy.nvim config:
{
  dir = "path/to/aria/editors/neovim",
  ft = "aria",
}
```

### Option C: Symlink into runtimepath

```bash
ln -s /path/to/aria/editors/neovim ~/.config/nvim/pack/aria/start/aria
```

## Features

- **Syntax highlighting** — Keywords, types, operators, strings, regex, numbers, comments (`--` / `---`)
- **File type detection** — Automatic `filetype=aria` for `*.aria` files

## MCP integration

Use [mcp.nvim](https://github.com/ravitemer/mcp.nvim) or a similar MCP client plugin:

```lua
-- Example with mcp.nvim
require("mcp").setup({
  servers = {
    aria = {
      command = "npx",
      args = { "aria-mcp" },
    },
  },
})
```

This gives your AI plugin (Copilot Chat, Avante, etc.) access to ARIA tools.

## CLI integration

Add keybindings for common ARIA operations:

```lua
-- In init.lua
vim.api.nvim_create_autocmd("FileType", {
  pattern = "aria",
  callback = function()
    -- Check current file
    vim.keymap.set("n", "<leader>ac", ":!npx aria check %<CR>", { buffer = true, desc = "ARIA Check" })
    -- Format current file
    vim.keymap.set("n", "<leader>af", ":!npx aria fmt %<CR>:e<CR>", { buffer = true, desc = "ARIA Format" })
    -- Generate from current file
    vim.keymap.set("n", "<leader>ag", ":!npx aria gen % -o generated/<CR>", { buffer = true, desc = "ARIA Gen" })
  end,
})
```

## Comment string

Add to your Neovim config so `gcc` (comment toggle) works:

```lua
vim.api.nvim_create_autocmd("FileType", {
  pattern = "aria",
  callback = function()
    vim.bo.commentstring = "-- %s"
  end,
})
```
