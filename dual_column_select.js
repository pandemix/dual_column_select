// This module expects Prototype

// DualColumnSelect v0.5
// written by Caleb Cullen, September 2007 - Wed, 14 Jan 2009 11:42:20 -0500
//
// Creates a multi-select input element consisting of two multi-select boxes and six buttons.
// AJAX search field and related inputs may optionally be included
// The layout is based on the canonical Windows select element: push and pull items from the
//   left-hand list of choices to the right-hand list of selected items; allow for submission,
//   resetting, cancellation, clearing the selection list, and of course moving one or more
//   elements to the left or to the right.
// In order to make adding this element to any random page as simple as possible, this widget
//   attempts to retrieve its starting value (what is selected) from another element on the page,
//   typically the link which caused it to appear. The idea is that this element may pop up in 
//   response to an IPE-type click event in a table.  It would be trivial to wire this up to a 
//   hidden field or some other such in order to use it in a more static form type context.
// A whole lot of options are provided, in order to customize the behavior and appearance of
//   the widget; more will be provided as the widget develops and comes to the point of being
//   able to insert all of its own elements into the flow rather than being loaded in from
//   the server.
//
//
// INSTANTIATION:
//
// [dcs =] new DualColumSelect(data_target[, opts])
//
//
// REQUIRED ARGUMENTS (for new):
//
// data_target == the ID (or extended element reference) of the element which is being edited
//
//
// MOST IMPORTANT OPTIONS:
//
// option_sortBy_function == a function which takes an Option as its argument and returns the
//   appropriate sort key, suitable for use with sortBy
// selection_parser == a function which takes some HTML (usually the invoking link's innerHTML)
//   and returns a list of duples suitable for creating Option elements ([text, value])
//   Default selection parsers are provided for use with 'hours' and 'weekdays' data
// selection_formatter == a function which takes an Option as its argument and returns the
//   appropriate string for use in formatting the new value for the display part of the view
// init_timeout == a function containing whatever instructions should be executed to initialize
//   the newly loaded/created widget; this might load a list into the choices box, and should
//   also set up the selections box with whatever the current value is.
// hidden_fields == a JS object keyed on HTML-element ID, with object as values; they have whatever
//   other attributes should be set on the hidden field.  For example:
//     hidden_fields: {lineitem_id: {name: 'id', value: '...'}}   ===>  
//       "<input type='hidden' id='lineitem_id' name='id' value='...' />"
//   Using this structure, any number of hidden fields may be included in order to be submitted
//   along with the form.
//
//
//// COSMETIC OPTIONS
//
// certainly all the various containers may be styled using CSS; they're easy enough to discover
//
// title == the title of the widget
// choices_title == the title of the choices select
// selections_title == the title of the selections select
// choices_contents == a string consisting of the HTML for the options; will be inserted into the
//   select using Element.update() (equivalent of replacing innerHTML)
//
//
//// AJAX SEARCH FUNCTIONS
//
// search_url == URL for submission of autosearch queries; should return an XML document containing
//   the option tags for the choice box; by default, the search string is called 's', and the target
//   type is called 't'.  FWIW, the last search string value is called 'last_sstr', but the field is
//   normally disabled before the form is submitted.  All field IDs are customizable through the
//   options, if there is any reason to do so.
// search_ttype_options == option tags [[text, value],...] for ttype selector; if undefined or empty
//   there will be no ttype selector
// DualColumnSelect.init_timeout_for_autosearch :: default function for initializing the widget
//   and launching a preliminary search to populate the choices side.
//
//
//// CREATION OF NEW SELECTIONS
//
// selection_creator == a function which will create a new 'choice' option from the source text in the
//   create_selection_field.  A predefined function is provided as part of the class; it is called
//   'create_selection', but the bound event handler is stored as 'selection_creator' so that it is
//   possible to unregister one function and register a new one; or a custom one may be provided in
//   the options hash.
// text_for_new == a function expecting the field as its argument and returning the appropriate text
//   for the new option.  By default this is equivalent to f.value
// value_for_new == a function expecting the field as its argument and returning the appropriate
//   value for the new option.  By default this is equivalent to f.value

var DualColumnSelect = Class.create({
    initialize: function(dt, opts) {
	if (!opts) opts = {};	
	this.data_target = dt || "dcs_target";
	this.data_target = $(opener ? opener.document.getElementById(this.data_target) : this.data_target);
	this.form = $(opts.form_name || "dcs_form");
	// LAYOUT RELATED STUFF
	this.choices_title = opts.choices_title || "Available Choices";
	this.selections_title = opts.selections_title || "Selected Items";
	this.title = opts.title || "Select!";
	this.width = opts.width || 500;
	this.sel_height = opts.sel_height || 225;
	this.sel_width = opts.sel_width || (this.width - 102) / 2; // 199 by default, as in original
	this.col_button_margins = opts.col_button_margins || {top: 16, right: 16, bottom: 0, left: 16};
	this.first_button_top_margin = opts.first_button_top_margin || 100;
	this.row_button_margins = opts.row_button_margins || {top: 16, right: 16, bottom: 16, left: 0};
	this.button_width = opts.button_width || 70;
	this.col_button_width = opts.col_button_width || this.button_width;
	this.row_button_width = opts.row_button_width || this.button_width;
	this.choices_contents = opts.choices_contents;
	this.choices_source = opts.choices_source;
	// DCS FORM ELEMENT INSTANTIATION
	if (!this.form) {
	    this.insert_dcs_form(opts);
	    this.form = $(opts.form_name || "dcs_form");
	}
	// ELEMENT REFERENCE SETUP
	this.editor = opts.editor || $('editor_area').firstChild;
	this.choices = $(opts.choices || "choices");
	this.selections = $(opts.selections || "selections");
	this.messagebox = $(opts.messagebox || "messagebox");
	this.errorbox = $(opts.errorbox || "flash_warning");
	// INTERFACE BUTTONS
	this.buttons = {select:   $(opts.select_button || "dcs_b_sel"),
			clear:    $(opts.clear_button || "dcs_b_clr"),
			deselect: $(opts.deselct_button || "dcs_b_dsl"),
			reset:    $(opts.reset_button || "dcs_b_rst"),
			cancel:   $(opts.cancel_button || "dcs_b_ccl"),
			submit:   $(opts.submit_button || "dcs_b_sub")};
	// MOST CALLBACKS (interface setup excepted)
	
	
    	this.choices_url = this.form.action.sub(/[^\/]*$/,"") + (opts.choices_action || "options_for_" + this.form.name.split("_")[0]);	
	this.option_sortBy_function = opts.option_sortBy_function || arguments.callee.option_sortBy_function;
	this.selection_parser = opts.selection_parser || arguments.callee.parse_selection;
	this.selection_formatter = opts.selection_formatter || arguments.callee.format_selection;
	this.close = opener ? function() { window.close(); } : function() { this.editor.hide(); }.bind(this);
	// SEARCH RELATED STUFF
	this.search_url = opts.search_url;
	if (this.search_url) {
	    this.search_field = $(opts.search_field || "sstr");
	    this.search_type_select = $(opts.search_type_select || "ttype");
	    this.last_search_value_field = $(opts.last_search_value_field || "last_sstr");
	}
	if (opts.allow_creation) { 
	    this.allow_creation = opts.allow_creation;
	    this.create_selection_field = $(opts.create_selection_field || "new_sel");
	    this.create_selection_form = $(this.create_selection_field.form);
	    if (opts.text_for_new) this.text_for_new = opts.text_for_new.bind(this);
	    if (opts.value_for_new) this.value_for_new = opts.value_for_new.bind(this);
	}
	// Setup an accessible link back to this object
	this.form.dcs = this;
	setTimeout((opts.init_timeout || arguments.callee.init_timeout).bind(this), 10);
    },
    // INTERFACE CREATION FUNCTION
    insert_dcs_form: function(opts) {
	// alert("opts is " + (opts ? "not null" : "null") + " in insert_dcs_form: form_name => "+opts.form_name+", form_id => "+(opts.form_id||opts.form_name)+"action => "+opts.form_action);
	var div = $(opts.div || "editor_area");
	var action = opts.form_action || "dcs_action";
	var form_name = opts.form_name || "dcs_form";
	var form_id = opts.form_id || form_name;
	var hidden_fields = $H(opts.hidden_fields || {}).map(function(i) {return "<input type='hidden' id='"+i.key+"' name='"+i.value.name+"' value='"+i.value.value+"'/>";}).join();
	var sel_style = "style='width: "+this.sel_width+"px; height: "+this.sel_height+"px;'";
	var first_col_button_style = "style='margin:"+this.first_button_top_margin+"px "+this.col_button_margins.right+"px "+this.col_button_margins.bottom+"px "+this.col_button_margins.left+"px; width: "+this.col_button_width+"px;'";
	var col_button_style = "style='margin:"+this.col_button_margins.top+"px "+this.col_button_margins.right+"px "+this.col_button_margins.bottom+"px "+this.col_button_margins.left+"px; width: "+this.col_button_width+"px;'";
	var row_button_style = "style='margin:"+this.row_button_margins.top+"px "+this.row_button_margins.right+"px "+this.row_button_margins.bottom+"px "+this.row_button_margins.left+"px; width: "+this.col_button_width+"px;'";
	var bnames =  {select:    opts.select_button || "dcs_b_sel",
		       clear:    opts.clear_button || "dcs_b_clr",
		       deselect: opts.deselct_button || "dcs_b_dsl",
		       reset:    opts.reset_button || "dcs_b_rst",
		       cancel:   opts.cancel_button || "dcs_b_ccl",
		       submit:   opts.submit_button || "dcs_b_sub"};
	var dcs_editor_html = "<div class='dcs_main' style='width: "+this.width+"px;'>\n<h3>"+this.title+":</h3>"
	if (opts.allow_creation) {
	    var csf = opts.create_selection_field || "new_sel";
	    var csfn = opts.create_selection_field_name || csf;
	    var csfl = opts.create_selection_field_label || "Create:";
	    var csflen = opts.create_selection_field_length || "40";
	    dcs_editor_html = dcs_editor_html + "<form name='dcs_selection_creator' id='dcs_selection_creator'>"+hidden_fields+"<div class='dcs_head'><label for='"+csf+
		"'>"+csfl+"</label>&nbsp;<input id='"+csf+"' name='"+csfn+"' type='text' length='"+csflen+"' /><br /></div></form>\n";
	}	    
	dcs_editor_html = dcs_editor_html + "<form action="+action+" name="+form_name+" id="+form_id+">\n"+hidden_fields;
	if (opts.search_url) {
	    var lsvf = opts.last_search_value_field || "last_sstr";
	    dcs_editor_html = dcs_editor_html+"<input type='hidden' name='"+lsvf+"' id='"+lsvf+"' value=''/><div class='dcs_head'>"+
		((typeof(opts.search_ttype_options) == "undefined" || opts.search_ttype_options.length == 0) ? "" : "<select id='"+(opts.search_type_select||"ttype")+"' name='t'>"+(opts.search_ttype_options||"")+"</select>")+
		"<label for='s'>"+(opts.search_field_name || "Search:")+
		"</label>&nbsp;<input type='text' id='"+(opts.search_field||"sstr")+"' name='s' length='40'/></div>\n";
	}
	dcs_editor_html = dcs_editor_html +
	    "<div id='messages'><p id='"+(opts.messagebox || 'messagebox')+"'>"+(opts.search_url ? (opts.search_message || "enter a search term in the text field") : "")+" "+
	    (opts.allow_creation ? (opts.create_message || "enter a new selection to create it") : "")+"</p>"+
	    "<p id='"+(opts.errorbox || 'errorbox')+"'></p></div>"+
	    "<div class='dcs_choices'><b id='choices_title'>"+this.choices_title+"</b><br /><select id='"+(opts.choices || 'choices')+"' name='choices[]' multiple length='15' "+sel_style+"><!-- name has [] because a list is returned; Rails expects this -->"+
	    (opts.choices_contents||"")+
	    "</select></div><div class='dcs_controls'><input type='button' "+first_col_button_style+" id='"+bnames.select+"' value='>>' /><br /><input type='button' "+col_button_style+" id='"+bnames.clear+"' value='Clear' /><br />"+
	    "<input type='button' "+col_button_style+" id='"+bnames.deselect+"' value='<<' /></div><div ='dcs_selections'><b id='selections_title'>"+this.selections_title+"</b><br />"+
	    "<select id='"+(opts.selections || 'selections')+"' name='selections[]' multiple length='15' "+sel_style+"><!-- name has [] because a list is returned; Rails expects this --></select></div>"+
	    "<div class='dcs_footer'><input type='button' value='Reset' "+row_button_style+" id='"+bnames.reset+"' /><input type='button' value='Cancel' "+row_button_style+" id='"+bnames.cancel+"' />"+
	    "<input type='button' value='Submit' "+row_button_style+" id='"+bnames.submit+"' /></div></form></div>";
	div.update(dcs_editor_html);
	if (opts.allow_creation) {
	    this.selection_creator = (opts.selection_creator || this.create_selection).bindAsEventListener(this);
	    $('dcs_selection_creator').observe('submit', this.selection_creator);
	}
	// alert(dcs_editor_html);
	if (!this.choices_contents && this.choices_source) {
	    new Ajax.Updater(this.choices, this.choices_source);
	}
	$(bnames.select).observe('click', this.select.bind(this));
	$(bnames.clear).observe('click', this.clear.bind(this));
	$(bnames.deselect).observe('click', this.deselect.bind(this));
	$(bnames.reset).observe('click', this.reset.bind(this));
	$(bnames.cancel).observe('click', this.close.bind(this));
	$(bnames.submit).observe('click', function(e){this.update().close();}.bind(this));
    },
    // BASIC CONTROL FUNCTIONS
    populate_from_xml: function(sel, doc) {
	sel = $(sel);
	sel.options.length = 0;
	doc = doc.firstChild;
	var optct = 0;
	$A(doc.childNodes).each(function(node) {
	    if (node.nodeName != "option") return;
	    if (node.nodeName == "option") {
		var value = "", text = "";
		if (node.getAttribute('value')) value = node.getAttribute('value');
		if (node.getAttribute('text')) text = node.getAttribute('text');
		else
		    if (node.firstChild && node.firstChild.nodeType == Node.TEXT_NODE) text = node.firstChild.nodeValue;
		if (value.length > 0) {
		    sel.options[optct] = new Option(text, value);
		    optct++;
		}
	    }
	});
	return optct;
    },
    populate_from_json: function(sel, json_array) {
	sel = $(sel);
	sel.options.length = 0;
	$A(json_array).each(function(o) {sel.appendChild(new Option(o[0], o[1]));});
    },
    move_option: function(src, dst, ind) {
	src = $(src);
	dst = $(dst);
	opt = $(src.options[ind]);
	src.removeChild(opt);
	dst.appendChild(opt);
	return opt;
    },
    copy_option: function(src, dst, ind) {
	src = $(src);
	dst = $(dst);
	opt = $(src.options[ind]);
	dst.appendChild(new Option(opt.text, opt.value));
	return opt;
    },
    copy_options: function(src, dst) {
	src = $(src);
	dst = $(dst);
	$A(src.options).each($).select(function(o) {return (o.selected && o.text);}).each(function(o) {dst.appendChild(new Option(o.text, o.value));});
    },
    move_options: function(src, dst) { // moves only selected options
	src = $(src);
	dst = $(dst);
	$A(src.options).each($).select(function(o) {return (o.selected && o.text);}).each(function(o) {
	    src.removeChild(o);
	    dst.appendChild(o);
	});
    },
    move_all_options: function(src, dst) {
	src = $(src);
	dst = $(dst);
	$A(src.options).each($).select(function(o) {return (o.text);}).each(function(o) {
	    src.removeChild(o);
	    dst.appendChild(o);
	});
	src.options.length = 0;
    },
    remove_option_by_value: function(src, val) {
	src = $(src);
	$A(src.options).each($).select(function(o) {return (o.value == val || o.text == val);}).each(function(o) {src.removeChild(o);});
    },
    remove_options: function(tgt) {
	tgt = $(tgt);
	$A(tgt.options).each($).select(function(o) {return (o.selected && o.text);}).each(function(o) {tgt.removeChild(o);});
    },
    add_option: function(tgt, lbl, val) {
	tgt = $(tgt);
	if (!(val+"")) val = lbl;
	tgt.appendChild(new Option(lbl, val));
    },
    sort_options: function(sel, sbf) { // as a basic function, we allow for the sort-by func to be passed to us; a higher level 'sort' routine would assume it
	sel = $(sel);
	sbf = sbf || this.option_sortBy_function;
	var opt_list = $A(sel.options);
	sel.options.length = 0;
	opt_list.sortBy(sbf).each(function(o) {sel.appendChild(o);});
    },
    // MAJOR INTERFACE FUNCTIONS
    extract: function(src) {
	if (!src)
	    src = this.data_target;
	var s = $(src);
	if (!s || s.innerHTML.length == 0)
	    return [];
	return this.selection_parser(s.innerHTML);
    },
    populate: function(src, dst) {
	dst = dst ? $(dst) : this.selections;
	var s = this.extract(src);
	dst.options.length = 0;
	s.each(function(i) {
	    if (i) {
		dst.options[dst.options.length] = new Option(i[0], i[1]);
		this.remove_option_by_value(this.choices, i[1]);
	    }
	}.bind(this));
	return this;
    },
    select: function() { this.move_options(this.choices, this.selections); this.sort_options(this.selections); return this;},
    deselect: function() { this.move_options(this.selections, this.choices); this.sort_options(this.choices); return this;},
    clear: function() { this.move_all_options(this.selections, this.choices); this.sort_options(this.choices); return this;},
    update: function(sel) {
	sel = sel ? $(sel) : this.selections;
	var h = $A(sel.options).map(function(o) {return this.selection_formatter(o);}.bind(this));
	if (h.length == 0) h.push("<i>none</i>");
	this.data_target.innerHTML = h.join(";&nbsp;");
	$A(sel.options).each(function(o){o.selected=true;});
	this.form.request({onSuccess: function(xhr) {this.messagebox.update("New settings saved"); new Effect.Highlight(this.messagebox);}.bind(this),
			   onFailure: function(xhr) {this.errorbox.update("An error occurred:\n"+xhr.responseText);}.bind(this)});
	return this;
    },
    reset: function() {
	this.move_all_options(this.selections, this.choices);
	this.sort_options(this.choices);
	return this.populate();
    },
    close: function() {
	if (opener) {
	    window.close();
	} else {
	    this.editor.hide();
	}
	return this;
    },
    // SEARCH RELATED FUNCTIONS
    search_and_update: function(qstr, msg_area, sel) {
	var url = this.search_url;
	msg_area = msg_area ? $(msg_area) : this.messagebox;
	sel = sel ? $(sel) : this.choices;
	return new Ajax.Request(url+"?"+qstr, { method: 'get', requestHeaders: {accept: 'text/xml'},
						onSuccess: function(xp) {
						    if (xp.responseText && Prototype.Browser.IE) { // MSIE has very broken XML handling
							// Wipe the retard's chin...
							xp.responseXML = new ActiveXObject("MSXML2.DOMDocument");
							// MSIE 7 seems incapable of parsing XML which has the ?xml declaration at the top, so I strip it out
							xp.responseXML.loadXML(xp.responseText.replace(/(\<\?[^\>]+\>)/, ""));
							// cutting the crust off the bread ...
						    }
						    this.messagebox.update("found "+this.populate_from_xml(sel, xp.responseXML)+" options");
						}.bind(this),
						onFailure: function(xp) {
						    this.messagebox.update("search failed");
						    // this.errorbox.update(xp.responseText);
						}.bind(this)});
    },
    search_if_changed: function(qstr) {
	var req = null;
	var sstrf = this.search_field;
	if (sstrf.value.length == 0) { // maybe there's some new, better way to do this now
	    sstrf.value = '%%%';
	    qstr = sstrf.form.serialize();
	}
	var sstr = qstr.toQueryParams().s;
	var last_sstr = this.last_search_value_field;
	if (last_sstr && last_sstr.value == sstr) return;
	last_sstr.value = sstr;
	if (sstr.length == 0) {
	    req = this.search_and_update(qstr);
	    this.messagebox.update("enter a search term in the text field");
	} else if (sstr.length < 3) {
	    this.messagebox.update("search string must be at least three characters long");
	} else {
	    last_sstr.time = new Date();
	    this.messagebox.update("searching...");
	    req = this.search_and_update(qstr);
	}
	sstrf.activate();
	return;
    },
    timed_search: function() {
	this.last_search_value_field.disable();
	this.search_if_changed(this.form.serialize());
	this.last_search_value_field.enable();
	return;
    },
    // ALLOW USERS TO CREATE NEW SELECTIONS
    create_selection: function(ev) {
	var f = this.create_selection_field;
	var t = (typeof(this.text_for_new) == "undefined") ? f.value : this.text_for_new(f);
	var v = (typeof(this.value_for_new) == "undefined") ? f.value : this.value_for_new(f);
	this.add_option(this.choices, v, v);
	this.sort_options(this.choices);
	ev.stop();
	f.clear();
	return false;
    }
    /* FARG: 
        	   $('messagebox') => this.messagebox
		   	   	   $('flash_warning') => this.errorbox
				   		   	 */
});

// attempt at aliases...
DualColumnSelect.prototype.submit = DualColumnSelect.prototype.update;
DualColumnSelect.prototype.remove_option = DualColumnSelect.prototype.remove_option_by_value;  

// Class Methods for data extraction; used to build specialized DCSs
// the instantiator will create a DCS capable of handling most data
// tweaks are required for handling hour-of-day and day-of-week selections
DualColumnSelect.parse_hours = function(html) {
    if (!html || html.length == 0) return [];
    var hours = [];
    html.split(";").invoke("strip").without("none", "<i>none</i>", "<I>none</I>", "always", "<i>always</i>", "<I>always</I>").each(function(x) {
	if (x.include("-")) {
	    var ep = x.split("-");
	    var m = ep[0];
	    var md, h, i;
	    while (m != ep[1]) {
		hours.push([m, netprophets.ampm_to_24hr(m)]);
		m = netprophets.advance_hour(m);
	    }
	    hours.push([m, netprophets.ampm_to_24hr(m)]);
	} else {
	    hours.push([x, netprophets.ampm_to_24hr(x)]);
	}
    });
    return hours;
};

DualColumnSelect.parse_weekdays = function(html) {
    return html.split(";").map(function(x){
	x = x.strip();
	var d = netprophets.abbrev_to_day.get(x);
	var n = netprophets.wdabbr_to_number.get(x);
	return ((d && n) ? [d, n] : null);
    }).compact();
};

DualColumnSelect.format_weekday_selection = function(o) { return netprophets.wd_abbrev[o.value]; };

DualColumnSelect.init_timeout_for_autosearch = function() {
    this.timed_search();
    this.populate();
    /* FIXME: the autosearch and other refinement-type widgets should be implemented as extra modules or subclasses */
    this.observer = new Form.Element.DelayedObserver(this.search_field, 1.5, this.timed_search.bind(this)); 
    this.search_type_select.observe('change', function(ev, v, lv) {if (!v) v=""; if (!lv) lv=""; this.last_search_value_field.value=lv; this.search_field.value=v; this.timed_search();}.bindAsEventListener(this, '%%%'));
};

// Some default methods for use in setting up new objects
DualColumnSelect.prototype.initialize.option_sortBy_function = function(o) {return o.value;};
DualColumnSelect.prototype.initialize.parse_selection = function(html) {return html.split(";").invoke("strip").without("none", "<i>none</i>", "<I>none</I>").map(function(x){return [x,x];});};
DualColumnSelect.prototype.initialize.format_selection = function(o) { return o.text; };
// The following two default functions must be bound to their object before they will work; the initializer sets this up properly
DualColumnSelect.prototype.initialize.init_timeout = function() { this.populate(); };


