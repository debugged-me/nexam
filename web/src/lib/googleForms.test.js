import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./googleDrive.js', () => ({
  requestDriveToken: vi.fn(),
}));

import { requestDriveToken } from './googleDrive.js';
import { requestFormsToken } from './googleForms.js';

describe('Google Forms authorization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the same narrow Drive token flow as the Materials picker', async () => {
    requestDriveToken.mockResolvedValue('drive-token');

    await expect(requestFormsToken('client-id', 'faculty@example.edu'))
      .resolves.toBe('drive-token');
    expect(requestDriveToken).toHaveBeenCalledWith('client-id', {
      hint: 'faculty@example.edu',
    });
  });
});
