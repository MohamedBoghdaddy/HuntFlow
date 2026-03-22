// Universal form filler — handles text, select, radio, checkbox, file uploads

export class FormFiller {
  constructor(profile, aiHelper) {
    this.profile = profile;
    this.ai = aiHelper;
  }

  // Main entry: fill all fields on the page
  async fillAll(container = document) {
    const fields = this._discoverFields(container);
    console.log(`[FormFiller] Found ${fields.length} fields`);
    for (const field of fields) {
      await this._fillField(field);
      await this._randomDelay(200, 600);
    }
  }

  _discoverFields(container) {
    const inputs = Array.from(container.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"]), textarea, select'
    ));
    const fileInputs = Array.from(container.querySelectorAll('input[type="file"]'));
    return [...inputs, ...fileInputs];
  }

  async _fillField(el) {
    const tag = el.tagName.toLowerCase();
    const type = (el.type || '').toLowerCase();
    const label = this._getLabel(el).toLowerCase();

    try {
      if (tag === 'select') {
        await this._fillSelect(el, label);
      } else if (type === 'checkbox') {
        await this._fillCheckbox(el, label);
      } else if (type === 'radio') {
        await this._fillRadio(el, label);
      } else if (type === 'file') {
        // File upload handled separately per platform
      } else if (tag === 'textarea' || type === 'text' || type === 'email' || type === 'tel' || type === 'number' || type === '') {
        await this._fillText(el, label, tag === 'textarea');
      }
    } catch (e) {
      console.warn('[FormFiller] Error filling field:', label, e);
    }
  }

  async _fillText(el, label, isTextarea) {
    if (el.value && el.value.trim()) return; // already filled

    const value = this._getValueForLabel(label, isTextarea);
    if (value === null || value === undefined) return;

    this._simulateTyping(el, String(value));
  }

  _getValueForLabel(label, isTextarea) {
    const p = this.profile;

    if (label.includes('first name') || label === 'first') return p.firstName;
    if (label.includes('last name') || label === 'last') return p.lastName;
    if (label.includes('full name') || label === 'name') return `${p.firstName} ${p.lastName}`;
    if (label.includes('email')) return p.email;
    if (label.includes('phone') || label.includes('mobile')) return p.phone;
    if (label.includes('address') && !label.includes('email')) return p.address;
    if (label.includes('city')) return p.city;
    if (label.includes('state') || label.includes('province')) return p.state;
    if (label.includes('zip') || label.includes('postal')) return p.zipCode;
    if (label.includes('country')) return p.country;
    if (label.includes('linkedin')) return p.linkedin;
    if (label.includes('github')) return p.github;
    if (label.includes('portfolio') || label.includes('website')) return p.portfolio;
    if (label.includes('salary') || label.includes('compensation')) return String(p.expectedSalary || '');
    if (label.includes('years') && label.includes('experience')) return String(p.yearsExperience || '');
    if (isTextarea && (label.includes('cover') || label.includes('motivation') || label.includes('about yourself'))) {
      return p.coverLetterTemplate || '';
    }
    if (isTextarea && label.includes('summary')) return p.summary || '';

    return null;
  }

  async _fillSelect(el, label) {
    const value = this._getValueForLabel(label, false);
    if (!value) return;

    const options = Array.from(el.options);
    const match = options.find(o =>
      o.text.toLowerCase().includes(value.toLowerCase()) ||
      o.value.toLowerCase().includes(value.toLowerCase())
    );

    if (match) {
      el.value = match.value;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  async _fillCheckbox(el, label) {
    const p = this.profile;
    if (label.includes('agree') || label.includes('terms') || label.includes('consent')) {
      if (!el.checked) {
        el.click();
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    if (label.includes('remote') && p.openToRemote !== false) {
      if (!el.checked) {
        el.click();
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  async _fillRadio(el, label) {
    // handled in groups
  }

  _simulateTyping(el, value) {
    el.focus();
    el.value = '';
    el.dispatchEvent(new Event('focus', { bubbles: true }));

    // React/Vue/Angular friendly: use input event
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement?.prototype || {},
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  _getLabel(el) {
    // Try aria-label
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    // Try associated <label>
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent.trim();
    }
    // Try parent label
    const parentLabel = el.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();
    // Try placeholder
    if (el.placeholder) return el.placeholder;
    // Try name
    if (el.name) return el.name.replace(/[_-]/g, ' ');
    // Try nearby text
    const wrapper = el.closest('div, li, td, tr, fieldset');
    if (wrapper) {
      const text = wrapper.querySelector('label, legend, span, p, div');
      if (text) return text.textContent.trim();
    }
    return '';
  }

  _randomDelay(min, max) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
