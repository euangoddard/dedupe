$(function () {
    'use strict';
    
    // Register a global helper for handlebars
    Handlebars.registerHelper('humanize_label', function (raw_label) {
        var label = raw_label.replace(/-/g, " ");
        return label.substr(0, 1).toUpperCase() + label.substr(1);
    });
    
    // Augment the set of events that jQuery understands to allow native d'n'd
    $.event.props.push('dragstart');
    
    // Data storage
    
    var DATA_STORE = {
        max_allowed_step: 1
    };
    
    // Views
    
    var _BaseStepView = Backbone.View.extend({
        
        events: {
            'click .step-back': 'step_back',
            'click .start-over': 'start_over'
        },
        
        show: function () {
            if (DATA_STORE.max_allowed_step < this.numeric_id) {
                alert_view.render({
                    title: 'Illegal step',
                    body: 'You must complete all previous steps first!',
                    level: 'warning'
                });
                
                var correct_step_label = this._convert_number_to_word(
                    DATA_STORE.max_allowed_step
                );
                app.navigate(correct_step_label, {trigger: true});
                return false;
            }
            this.$el.removeClass('future');
            this.$el.removeClass('past');
            this.$el.nextAll().addClass('future').removeClass('past');
            this.$el.prevAll().addClass('past').removeClass('future');
            $('#current-step').text(this.numeric_id);
            return true;
        },
        
        step_back: function () {
            var previous_step_label = this._convert_number_to_word(
                this.numeric_id - 1
            );
            DATA_STORE.max_allowed_step = this.numeric_id - 1;
            app.navigate(previous_step_label, {trigger: true});
        },
        
        step_forward: function () {
            var next_step_label = this._convert_number_to_word(
                this.numeric_id + 1
            );
            app.navigate(next_step_label, {trigger: true});
        },
        
        start_over: function () {
            DATA_STORE.max_allowed_step = 1;
            app.navigate('one', {trigger: true});
        },
        
        _convert_number_to_word: function (number) {
            switch (number) {
                case 1: return 'one';
                case 2: return 'two';
                case 3: return 'three';
                case 4: return 'four';
                default:
                    throw new Error('Cannot convert "' + number + '" to a word');
            }
        }
        
    });
    
    var _BaseFileReaderView = _BaseStepView.extend({
        events: _.extend({}, _BaseStepView.prototype.events, {
            'change :file': 'read_file'
        }),
        
        read_file: function (event) {
            alert_view.render({
                level: 'info',
                body: 'please wait...',
                title: 'Reading file'
            });
            
            var self = this;
            
            read_file({
                file: event.target.files[0],
                success: function (file_contents) {
                    try {
                        var csv_data = csv.decode_to_objects(file_contents);
                        
                        if (csv_data.length === 0) {
                            alert_view.render({
                                title: 'Empty file!',
                                body: 'You must use a CSV file with at least one row',
                                level: 'error'
                            });
                            
                        } else {
                            var headers = _.keys(csv_data[0]);
                            alert_view.render({
                                level: 'success',
                                title: 'CSV file loaded',
                                body: 'Found headers: ' + headers.join(', ')
                            });
                            
                            DATA_STORE[self.data_store_key] = csv_data;
                            DATA_STORE.max_allowed_step = self.numeric_id + 1;
                            self.step_forward();
                        }
                        
                    } catch (error) {
                        alert_view.render({
                            title: 'There are an error reading the CSV file',
                            body: error.toString(),
                            level: 'error'
                        });
                    }
                    
                },
                error: function (error_message) {
                    alert_view.render({
                        level: 'error',
                        title: 'There are an error reading the CSV file',
                        body: error_message
                    });
                }
            });
        }
    });
    
    var Step1View = _BaseFileReaderView.extend({
        numeric_id: 1,
        
        data_store_key: 'master_file_data',
        
        el: $('#master-file-chooser')
        
    });
    
    var Step2View = _BaseFileReaderView.extend({
        numeric_id: 2,
        
        data_store_key: 'new_file_data',

        el: $('#new-file-chooser')
    });
    
    var Step3View = _BaseStepView.extend({
        numeric_id: 3,
        
        el: $('#header-chooser'),
        
        template: Handlebars.compile($("#common-headers-template").html()),
        
        events: {
            'submit form': 'submit_form'
        },
        
        render: function () {
            if (!DATA_STORE.master_file_data || ! DATA_STORE.new_file_data) {
                alert_view.render({
                    level: 'error',
                    title: 'No files specified',
                    body: 'Ensure that you have chosen two CSV files'
                });
                this.step_back();
                return;
            }
            
            var master_headers = _.keys(DATA_STORE.master_file_data[0]);
            var new_headers = _.keys(DATA_STORE.new_file_data[0]);
            var common_headers = _.intersection(new_headers, master_headers);

            if (common_headers.length) {
                alert_view.render({
                    title:"Found common headers",
                    body: "Choose the ones to compare the data on",
                    level: "info"
                });
                
                this.$el.find('ul').remove();
                this.$el.find('form').prepend(
                    this.template({headers: common_headers})
                );
                this.$el.find('button').prop('disabled', false);

            } else {
                alert_view.render({
                    title: "There are no headers in common",
                    body: "Choose another file or files for comparison",
                    level: "warning"
                });
                this.$el.find('button').prop('disabled', true);
            }
            
        },
        
        submit_form: function (evt) {
            evt.preventDefault();
            
            var chosen_headers = [];
            this.$el.find(':checkbox:checked').each(function () {
                chosen_headers.push($(this).val());
            });
            
            if (chosen_headers.length) {
                alert_view.render({
                    title: "Starting file comparison",
                    body: "Please wait",
                    level: "info"
                });
                
                this.$el.find(':input').prop('disabled', true);
                
                DATA_STORE.chosen_headers = chosen_headers;
                DATA_STORE.max_allowed_step = self.numeric_id + 1;
                this.step_forward();
                
            } else {
                alert_view.render({
                    title: "Cannot proceed",
                    body: "You must select at least one header",
                    level: "warning"
                });
            }
            
        }
    });
    
    var Step4View = _BaseStepView.extend({
        numeric_id: 4,
        
        el: $('#output-chooser'),
        
        template: Handlebars.compile($('#output-item-template').html()),
        
        process_data: function () {
            // Make a hash table of the master data
            var hashed_master_data = make_hashed_rows(
                DATA_STORE.master_file_data,
                DATA_STORE.chosen_headers
            );
            var new_records_in_master_data = [];
            var new_records_not_in_master_data = [];
            var master_records_also_in_new_data = [];
            
            _.each(DATA_STORE.new_file_data, function (new_data_row) {
                var new_row_hash = make_row_hash_key(
                    new_data_row,
                    DATA_STORE.chosen_headers
                );
                var corresponding_master_row = hashed_master_data[new_row_hash];
                
                if (typeof corresponding_master_row === "undefined") {
                    new_records_not_in_master_data.push(new_data_row);
                } else {
                    new_records_in_master_data.push(new_data_row);
                    master_records_also_in_new_data.push(corresponding_master_row);
                }
            });
            
            var master_headers = _.keys(DATA_STORE.master_file_data[0]);
            var new_headers = _.keys(DATA_STORE.new_file_data[0]);
            
            store_temporary_file(
                'new-records-in-master',
                new_headers,
                new_records_in_master_data
            );
            store_temporary_file(
                'new-records-not-in-master',
                new_headers,
                new_records_not_in_master_data
            );
            store_temporary_file(
                'master-records-also-in-new',
                master_headers,
                master_records_also_in_new_data
            );
            
            alert_view.render({
                title: "Comparison complete",
                body: "You can now download the resulting files",
                level: "success",
            });
        },
        
        render_output: function (file_key, download_url) {
            var context = {
                label: file_key,
                url: download_url
            };
            this.$el.find('ul').append(this.template(context));
        }
    
    });
    
    var AlertView = Backbone.View.extend({
        
        className: 'alert',
        
        template: Handlebars.compile($('#alert-template').html()),
        
        initialize: function () {
            $(document).on(
                'click',
                '.' + this.className + ' button.close',
                function () {
                    $(this).parent().remove();
                }
            );
        },
        
        render: function (params) {
            var self = this;
            setTimeout(function () {
                var alert_html = self.template(params);
                $('#alert-container .container').html(alert_html);
            }, 1);
        }
        
    });
    
    var alert_view = new AlertView();
    
    // Routing
    
    var Application = Backbone.Router.extend({

        routes: {
            'one': 'step1',
            'two': 'step2',
            'three': 'step3',
            'four': 'step4'
        },
        
        views: {
            step1: new Step1View(),
            step2: new Step2View(),
            step3: new Step3View(),
            step4: new Step4View()
        },

        step1: function () {
            this.views.step1.show();
        },
        
        step2: function () {
            this.views.step2.show();
        },
        
        step3: function () {
            if (this.views.step3.show()) {
                this.views.step3.render();
            }
        },
        
        step4: function () {
            if (this.views.step4.show()) {
                this.views.step4.process_data();
            }
        }

    });
    
    // Utilities
    
    var read_file = function (params) {
        var file_reader = new FileReader();
        file_reader.onload = function (read_event) {
            var file_contents = read_event.target.result;
            params.success(file_contents);
        };
        file_reader.onerror = function (read_event) {
            params.success(file_contents);
            var error_message = "";
            switch (read_event.target.error.code) {
                case read_event.target.error.NOT_FOUND_ERR:
                    error_message = "File Not Found";
                    break;
                case read_event.target.error.NOT_READABLE_ERR:
                    error_message = "File is not readable";
                    break;
                case read_event.target.error.ABORT_ERR:
                    error_message = "File reading was aborted";
                    break;
                default:
                    error_message = "An error occurred reading this file";
            };
            params.error(error_message);
        };
        var current_file = params.file;
        file_reader.readAsText(current_file);
    };
    
    /**
     * Take ``row`` and extract the column data which match 
     * ``headers_to_use`` then create concatenate these together to make a
     * key for a hash table
     * 
     * @private
     * @param {Object} row The CSV data representing a single row
     * @param {Array} headers_to_use The names of the headers to consider
     * @returns {String} A concatenation of the header values for this row
     * 
     */
    var make_row_hash_key = function (row, headers_to_use) {
        var key = "";
        _.each(headers_to_use, function (header) {
            key += row[header];
        });
        return key;
    };
    
    /**
     * Make a hash table from ``rows`` using ``headers_to_use`` as the
     * basis for the key and the entirety of the row as the value.
     * 
     * This utility serves to allow rapid comparison of two sets of CSV data
     * 
     * @private
     * @param {Array} rows The CSV data as an array of objects
     * @param {Array} headers_to_use The names of the headers to consider
     * @returns {Object} A hash of the row data
     * 
     */
    var make_hashed_rows = function (rows, headers_to_use) {
        var hash_table = {};
        _.each(rows, function (row) {
            hash_table[make_row_hash_key(row, headers_to_use)] = row;
        });
        return hash_table;
    };
    
    var handle_write_error = function (err) {
        var message = '';
        
        switch (err.code) {
            case FileError.QUOTA_EXCEEDED_ERR:
                message = 'Disk quota exceeded';
                break;
            case FileError.NOT_FOUND_ERR:
                message = 'Cannot find file to write to';
                break;
            case FileError.SECURITY_ERR:
                message = 'Security error';
                break;
            case FileError.INVALID_MODIFICATION_ERR:
                message = 'Invalid modification error';
                break;
            case FileError.INVALID_STATE_ERR:
                message = 'Invalid state of file';
                break;
            default:
                message = 'Unknown Error';
                break;
        };
        
        alert_view.render({
            level: 'error',
            title: 'Write failed',
            body: message
        });
    };
    
    var store_temporary_file = function (file_key, headers, file_data) {
        window.webkitRequestFileSystem(
            window.TEMPORARY,
            5*1024*1024 /*5MB*/,
            function (file_system) {
                file_system.root.getFile(
                    file_key + '.csv',
                    {create: true},
                    function (file_entry) {
                        file_entry.createWriter(function (file_writer) {

                            file_writer.onwriteend = function (e) {
                                app.views.step4.render_output(
                                    file_key,
                                    file_entry.toURL()
                                );
                            };

                            file_writer.onerror = handle_write_error;

                            var blob_builder = new window.WebKitBlobBuilder();
                            var csv_data = csv.encode_objects(file_data, headers);
                            console.log(csv_data);
                            blob_builder.append(csv_data);
                            file_writer.seek(0);
                            file_writer.write(blob_builder.getBlob('text/csv'));
                        }, handle_write_error
                        );
                    },
                    handle_write_error
                );
            },
            handle_write_error
        );
    };
    
    $(document).on("dragstart", ".dragout", function (evt) {
        var original_event = evt.originalEvent;
        var download_url = $(this).data('download-url');
        original_event.dataTransfer.setData('DownloadURL', download_url); 
    });

    // Start the application 
    var app = new Application();
    
    Backbone.history.start();
    
    if (!location.hash) {
        app.navigate('one', {trigger: true});
    }
    
});
