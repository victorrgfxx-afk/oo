(function(){
 class AISiteBuilder extends HTMLElement {
   constructor() {
     super();
     this.attachShadow({mode:'open'});
     this.state = { blueprint: null };
     this.render();
   }
   connectedCallback() {
   }
   render() {
     const shadow = this.shadowRoot;
     shadow.innerHTML = `
       <style>
         :host {
           font-family: sans-serif;
           display: block;
           border: 1px solid #e5e7eb;
           border-radius: 0.5rem;
           padding: 1rem;
           background: #fff;
         }
         button {
           padding: 0.5rem 1rem;
           margin-top: 0.5rem;
           border-radius: 0.375rem;
           border: none;
           cursor: pointer;
           background: #6366f1;
           color: #fff;
         }
         textarea {
           width: 100%;
           min-height: 80px;
           border: 1px solid #d1d5db;
           border-radius: 0.375rem;
           padding: 0.5rem;
           resize: vertical;
           font-family: inherit;
         }
       </style>
       <div>
         <textarea placeholder="Describe your project..."></textarea>
         <button id="generate">Generate</button>
         <pre id="output" style="margin-top:0.5rem;background:#f9fafb;padding:0.5rem;border-radius:0.375rem;"></pre>
       </div>
     `;
     shadow.querySelector('#generate').addEventListener('click', () => {
       const brief = shadow.querySelector('textarea').value.trim();
       const blueprint = { brief, generatedAt: new Date().toISOString() };
       this.state.blueprint = blueprint;
       shadow.querySelector('#output').textContent = JSON.stringify(blueprint, null, 2);
       this.dispatchEvent(new CustomEvent('aiwb:generate', { detail: blueprint }));
     });
   }
   getBlueprint() {
     return this.state.blueprint;
   }
   setBrief(text) {
     const shadow = this.shadowRoot;
     shadow.querySelector('textarea').value = text;
   }
   exportJSON() {
     return JSON.stringify(this.state.blueprint || {}, null, 2);
   }
   exportHTML() {
     return '<!DOCTYPE html><html><body><pre>' + this.exportJSON() + '</pre></body></html>';
   }
 }
 if (!customElements.get('ai-site-builder')) {
   customElements.define('ai-site-builder', AISiteBuilder);
 }
 window.AIWB = {
   init(target, options = {}) {
     const el = document.createElement('ai-site-builder');
     // set attributes
     for (const key in options) {
       if (options[key] !== undefined && options[key] !== null) {
         el.setAttribute(key, options[key]);
       }
     }
     const container = typeof target === 'string' ? document.querySelector(target) : target;
     container.appendChild(el);
     return {
       on: (eventName, callback) => { el.addEventListener(eventName, callback); return this; },
       getBlueprint: () => el.getBlueprint(),
       setBrief: (brief) => el.setBrief(brief),
       exportJSON: () => el.exportJSON(),
       exportHTML: () => el.exportHTML()
     };
   }
 };
})();
