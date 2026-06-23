import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchableSelect, { type SelectOption } from './SearchableSelect'

const OPTIONS: SelectOption[] = [
  { value: 's1', label: 'Surging Sparks' },
  { value: 's2', label: 'Prismatic Evolutions' },
  { value: 's3', label: 'Stellar Crown' },
]

function setup(extra?: Partial<React.ComponentProps<typeof SearchableSelect>>) {
  const onChange = vi.fn()
  render(
    <SearchableSelect options={OPTIONS} value="" onChange={onChange} placeholder="Pick a set" {...extra} />
  )
  const input = screen.getByPlaceholderText('Pick a set')
  return { onChange, input }
}

describe('SearchableSelect', () => {
  it('opens the option list on focus', async () => {
    const user = userEvent.setup()
    const { input } = setup()

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    await user.click(input)

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(3)
  })

  it('filters options case-insensitively by the typed query', async () => {
    const user = userEvent.setup()
    const { input } = setup()

    await user.click(input)
    await user.type(input, 'pris')

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('Prismatic Evolutions')
  })

  it('calls onChange with the option value when an option is selected', async () => {
    const user = userEvent.setup()
    const { input, onChange } = setup()

    await user.click(input)
    await user.click(screen.getByText('Stellar Crown'))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('s3')
    // List closes after selection.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows "No matches" when nothing matches the query', async () => {
    const user = userEvent.setup()
    const { input } = setup()

    await user.click(input)
    await user.type(input, 'zzz')

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(screen.getByText('No matches')).toBeInTheDocument()
  })

  it('closes the list when Escape is pressed', async () => {
    const user = userEvent.setup()
    const { input } = setup()

    await user.click(input)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('does not open when disabled', async () => {
    const user = userEvent.setup()
    const { input } = setup({ disabled: true })

    await user.click(input)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
