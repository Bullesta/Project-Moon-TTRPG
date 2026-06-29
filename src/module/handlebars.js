export class PMTTRPGRegisterHelpers {
  static init() {
    Handlebars.registerHelper('concat', function() {
      var outStr = '';
      for (var arg in arguments) {
        if (typeof arguments[arg] != 'object') {
          outStr += arguments[arg];
        }
      }
      return outStr;
    });

    Handlebars.registerHelper('toLowerCase', function(str) {
      return str.toLowerCase();
    });

    Handlebars.registerHelper('PMTTRPGTags', function(tagsInput) {
      const tags = typeof tagsInput === 'string' ? JSON.parse(tagsInput) : tagsInput;
      let output = '<div class="tags">';
      for (let tag of tags) {
        output += `<div class="tag">${tag.value}</div>`;
      }
      output += '</div>';
      return output;
    });

    Handlebars.registerHelper('dwTags', function(tagsInput) {
      const tags = typeof tagsInput === 'string' ? JSON.parse(tagsInput) : tagsInput;
      if (!tags || tags.length < 1) return '';
      let output = '<div class="tags">';
      for (let tag of tags) {
        output += `<div class="tag">${tag.value}</div>`;
      }
      output += '</div>';
      return output;
    });

    Handlebars.registerHelper('includes', function(haystack, needle, options) {
      if (haystack.includes(needle)) {
        return options.fn(this);
      }
    });

    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('ifor', function(arg1, arg2, options) {
      if (arg1 || arg2) {
        return options.fn(this);
      }
    });

    Handlebars.registerHelper('progressCircle', function(data) {
      return `<svg class="progress-ring progress-ring--${data.class}" viewBox="0 0 ${data.diameter} ${data.diameter}" width="${data.diameter}" height="${data.diameter}">
      <circle
        class="progress-ring__circle"
        stroke-width="${data.strokeWidth}"
        stroke-dasharray="${data.circumference}"
        stroke-dashoffset="${data.offset}"
        stroke="${data.color}"
        fill="transparent"
        r="${data.radius}"
        cx="${data.position}"
        cy="${data.position}"
      />
    </svg>`;
    });

    Handlebars.registerHelper('localizeOverride', function(i18nKey, settingKey = false) {
      let result = settingKey ? game.settings.get('projectmoonttrpg', settingKey) : '';
      if (typeof result === 'string' && result.length > 0) {
        return result;
      }
      else {
        return game.i18n.localize(i18nKey) ?? '';
      }
    });
  }
}