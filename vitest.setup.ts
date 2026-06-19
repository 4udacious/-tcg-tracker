// Registers jest-dom matchers (toBeInTheDocument, etc.) on Vitest's expect and
// installs automatic React Testing Library cleanup between tests.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
