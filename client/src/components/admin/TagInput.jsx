import { useState } from 'react'
import { X } from 'lucide-react'

const TagInput = ({ tags = [], onChange, placeholder = 'Add item...', disabled = false }) => {
  const [input, setInput] = useState('')

  const addTag = () => {
    const value = input.trim()
    if (!value || tags.includes(value)) {
      setInput('')
      return
    }
    onChange([...tags, value])
    setInput('')
  }

  const removeTag = (tag) => {
    onChange(tags.filter((t) => t !== tag))
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 border border-gray-300 rounded-lg bg-white min-h-[42px]">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-sm"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-indigo-600 hover:text-indigo-900"
              aria-label={`Remove ${tag}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            }
          }}
          onBlur={addTag}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[80px] text-sm outline-none border-0 p-0.5"
        />
      )}
    </div>
  )
}

export default TagInput
