export class PMTTRPGRegisterHelpers {
  static init() {
    Handlebars.registerHelper('toLowerCase', function(str) {
      return str.toLowerCase();
    });

    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });
  }
}