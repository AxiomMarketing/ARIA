" Vim syntax file for ARIA specification language
" Language:   ARIA (.aria)
" Maintainer: ARIA contributors
" License:    MIT

if exists("b:current_syntax")
  finish
endif

" Comments
syn match ariaLineComment "--.*$" contains=@Spell
syn region ariaDocComment start="---" end="$" contains=@Spell

" Strings
syn region ariaString start='"' skip='\\"' end='"'

" Regex literals
syn region ariaRegex start='/' end='/' contained

" Numbers
syn match ariaNumber '\<\d[0-9_]*\(\.\d[0-9_]*\)\?\>'

" Module keywords
syn keyword ariaModuleKw module version target author import from supersedes

" Type keywords
syn keyword ariaTypeKw type is where self of computed as
syn keyword ariaTypeBase Integer Decimal String Boolean DateTime Record Enum List

" Contract keywords
syn keyword ariaContractKw contract inputs requires ensures on_failure
syn keyword ariaContractKw when return with examples given then
syn keyword ariaContractKw effects sends writes creates reads deletes
syn keyword ariaContractKw depends_on timeout retry max backoff on_exhaust
syn keyword ariaContractKw rate_limit per steps compensate
syn keyword ariaContractKw deprecated dispatch

" Behavior keywords
syn keyword ariaBehaviorKw behavior states initial transitions
syn keyword ariaBehaviorKw invariants forbidden flow

" Temporal assertion keywords
syn keyword ariaTemporalKw always never eventually leads_to within once

" Operators
syn keyword ariaOperator and or not implies in valid exists
syn match ariaOperator "=="
syn match ariaOperator "!="
syn match ariaOperator ">="
syn match ariaOperator "<="
syn match ariaOperator "->"
syn match ariaOperator ">"
syn match ariaOperator "<"

" Constants
syn keyword ariaBoolean true false

" Special
syn keyword ariaSpecial result old length now matches starts_with increased_by

" Highlighting
hi def link ariaLineComment Comment
hi def link ariaDocComment SpecialComment
hi def link ariaString String
hi def link ariaRegex String
hi def link ariaNumber Number
hi def link ariaModuleKw Structure
hi def link ariaTypeKw Keyword
hi def link ariaTypeBase Type
hi def link ariaContractKw Keyword
hi def link ariaBehaviorKw Keyword
hi def link ariaTemporalKw Special
hi def link ariaOperator Operator
hi def link ariaBoolean Boolean
hi def link ariaSpecial Identifier

let b:current_syntax = "aria"
