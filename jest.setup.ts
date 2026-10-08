import '@testing-library/jest-dom'

// Mock de Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: {}, error: null }),
    })),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: { path: 'test' }, error: null }),
        download: jest.fn().mockResolvedValue({ data: new Blob(), error: null }),
      })),
    },
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: '123', email: 'test@test.com' } } }),
    },
  })),
}))

// Mock de next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock de crypto.randomUUID
if (!global.crypto) {
  Object.defineProperty(global, 'crypto', {
    value: {
      randomUUID: () => 'test-random-uuid-1234',
    },
  })
} else if (!global.crypto.randomUUID) {
  Object.defineProperty(global.crypto, 'randomUUID', {
    value: () => 'test-random-uuid-1234',
    writable: true,
    configurable: true,
  })
}
