module.exports = function (grunt) {
    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        js_src: 'src/js',
        css_src: 'src/css',

        watch: {
            options: {
                livereload: true,
            },
            js: {
                files: ['<%= js_src %>/**/*.js', '!<%= js_src %>/**/*.min.js']
            },
            css: {
                files: ['<%= css_src %>/**/*.css', '!<%= css_src %>/**/*.min.css']
            },
            html: {
                files: ['**/*.html']
            },
        }
    });

    // Uglify plugin to minimise and concatenate assets
    grunt.loadNpmTasks('grunt-contrib-watch');
};