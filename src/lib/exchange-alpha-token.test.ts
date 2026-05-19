import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exchangeAlphaToken } from './exchange-alpha-token';

describe('exchangeAlphaToken', () => {
  beforeEach(() => {
    process.env.ALPHA_FUNCTIONS_URL = 'https://alpha.example.com/functions/v1';
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    delete process.env.ALPHA_FUNCTIONS_URL;
    vi.unstubAllGlobals();
  });

  it('throws a clear error when ALPHA_FUNCTIONS_URL is missing', async () => {
    delete process.env.ALPHA_FUNCTIONS_URL;
    await expect(exchangeAlphaToken('tok')).rejects.toThrow(
      'ALPHA_FUNCTIONS_URL not configured'
    );
  });

  it('POSTs the token to /users/get-real-estate-info', async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      user_profile_id: 'u_1',
      email: 'a@b.com',
      name: 'Jane Smith',
      community: 'Miami',
      lat: 25.76, lon: -80.19, city: 'Miami', zip: '33101',
      enrollment_status: 'enrolled',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await exchangeAlphaToken('the-token');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://alpha.example.com/functions/v1/users/get-real-estate-info',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'the-token' }),
      })
    );
  });

  it('returns the parsed AlphaUserInfo on 200', async () => {
    const info = {
      user_profile_id: 'u_1',
      email: 'a@b.com',
      name: 'Jane Smith',
      community: 'Miami Beach',
      lat: 25.79, lon: -80.13, city: 'Miami Beach', zip: '33139',
      enrollment_status: 'committed',
    };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(info), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));

    const result = await exchangeAlphaToken('tok');
    expect(result).toEqual(info);
  });

  it('throws an error whose message contains the Alpha error code on 401', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: 'token_expired',
      message: 'Token has expired',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));

    await expect(exchangeAlphaToken('expired-token')).rejects.toThrow(/token_expired/);
  });

  it('distinguishes invalid_signature from token_expired', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      error: 'invalid_signature',
      message: '...',
    }), { status: 401, headers: { 'Content-Type': 'application/json' } }));

    await expect(exchangeAlphaToken('tampered')).rejects.toThrow(/invalid_signature/);
  });

  it('includes the HTTP status in the error message when no error code is returned', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Server error', { status: 500 }));

    await expect(exchangeAlphaToken('tok')).rejects.toThrow(/500/);
  });

  it('strips trailing slash(es) from ALPHA_FUNCTIONS_URL so the request URL never has a double slash', async () => {
    process.env.ALPHA_FUNCTIONS_URL = 'https://alpha.example.com/functions/v1/';
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue(new Response(JSON.stringify({
      user_profile_id: 'u_1',
      email: 'a@b.com',
      name: 'Jane Smith',
      community: 'Miami',
      lat: null, lon: null, city: null, zip: null,
      enrollment_status: null,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await exchangeAlphaToken('the-token');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://alpha.example.com/functions/v1/users/get-real-estate-info',
      expect.anything()
    );
  });

  it('propagates network failures', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(exchangeAlphaToken('tok')).rejects.toThrow('ECONNREFUSED');
  });
});
