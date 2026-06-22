import fs from 'fs';
import { renderTextFiles } from './common/fileRenderer.js';

/**
 * Text output provider — plain .lst files with templates and layout.
 */
export async function render(raw, options, context) {
    return renderTextFiles(raw, options, context);
}

export default { id: 'text', render };
