//let include_only = ['#sm-style-css']; // list of selectors to include only
//include_only = [ ...document.querySelectorAll( include_only.join( ', ' ) ) ].map( el => el );

//let exclude = ['#borlabs-cookie-css', ]; // list of selectors to exclude
//exclude = [ ...document.querySelectorAll( exclude.join( ', ' ) ) ].map( el => el );

const stylesStructure = async (el) => {

    if ( typeof include_only === 'array' && include_only?.length && !include_only.includes( el ) ) { return }
    if ( typeof exclude === 'array' && exclude.includes( el ) ) { return }

    const getContent = async url => {
        const getPath = url => {
            const doc = document.implementation.createHTMLDocument( '' ),
                  a = doc.createElement( 'a' );
            a.href = url;
            return a.href.replace( a.hash, '' ).replace( a.search, '' ).replace( /([^\/])\/[^\.\/]+(?:\.[^\.\/]+)+$/, '$1/' ); // hash, query, filename
        };
        const path = getPath( url );
        const fixUrls = content => {
            let new_content = content;
            new_content = new_content.replace( /url\(('|")?(https?\:\/\/|\/|\/\/|data\:)?(.{10})/gi, (m, m1, m2, m3) => { // ++remove m3 & logs
                //console.log( m );
                if ( m2 ) { return m }
                //console.log( '^this to this v' );
                //console.log( 'url(' + (m1||'') + path + m3 );
                //console.log( path );
                return 'url(' + (m1||'') + path + m3;
            });
            new_content = new_content.replace( /\@import\s*('|")(https?\:\/\/|\/|\/\/|data\:)?(.{10})/gi, (m, m1, m2, m3) => { // ++remove m3 & logs
                //console.log( m );
                if ( m2 ) { return m }
                //console.log( '^this to this v' );
                //console.log( '@import ' + (m1||'') + path + m3 );
                //console.log( path );
                return '@import ' + (m1||'') + path + m3;
            });
            return new_content;
        };
        const response = await fetch( url );
        if ( !response.ok ) { return ''; }
        return await fixUrls( await response.text() );
    }

    const importStyles = async ( parsed ) => {
        let style = [];
        for ( let rule of parsed ) {
            if ( rule.constructor.name !== 'CSSImportRule' ) { break } // @import can only be at the start of a css document
            style.push( await stylesStructure( rule ) );
        }
        return style;
    };
    const parseCSS = s => {
        const doc = document.implementation.createHTMLDocument( '' ),
              style = doc.createElement( 'style' );
        style.textContent = s;
        doc.body.appendChild( style );
        return style.sheet.cssRules;
    };
    const url = el?.href || window.location.href,
          tag = el?.tagName?.toLowerCase() || '@import',
          content = el?.textContent || await getContent( url );
    let result = { // some might be not needed
        tag,
        url,
        content,
        parsed : parseCSS( content ),
        el
    };

    result.imported = await importStyles( result.parsed ); // @import

    return result;
};

const allStyles = ( await Promise.all( [...document.querySelectorAll( 'link[rel=stylesheet], style' )].map( stylesStructure ) ) ).filter( s => s );

const dom = (() => {

    const onFirstScreen = el => {
        const isFixed = el => {
            if ( el === document ) { return false }
            const position = window.getComputedStyle( el )?.getPropertyValue( 'position' );
            if ( position === 'fixed' ) { return true }
            return isFixed( el.parentNode );
            // ++ the fixed el is in range && is visible
        };
        const r = el.getBoundingClientRect();
        return (
            r.top + scroll.top < win.height &&
            r.left + scroll.left < win.width
            //&&
            //r.bottom + scroll.top > 0 &&
            //r.right + scroll.left > 0
        ) || isFixed( el );
    };

    const win = {
        width: ( window.innerWidth || document.documentElement.clientWidth ) + 1,
        height: ( window.innerHeight || document.documentElement.clientHeight ) + 1
    };
    win.height = Math.round( win.height * 1.1 );
    const scroll = { top: document.documentElement.scrollTop, left: document.documentElement.scrollLeft };

    let dom = { all : [], first : [], rest : [] }; //++-- rest not needed actually? all too? or change tha alg to compare
    document.body.querySelectorAll( '*' ).forEach( el => {
        dom.all.push( el );
        ( onFirstScreen( el ) ? dom.first : dom.rest ).push( el );
    });

    dom.all.push( document.documentElement );
    dom.all.push( document.body );
    dom.first.push( document.documentElement );
    dom.first.push( document.body );

    return dom;
})();

//console.log( dom );
//throw '';

const stylesBundle = structure => {
    // ++split / not split a selector - add to settings
    // ++try-catch if selector is valid after cleaning with logging in the console
    const bundle = { first : '', rest : '', unused : '', randu : '', all : '',
        add : function(values) {
            merge( this, values );
        }
    };
    Object.defineProperty( bundle, 'add', { enumerable: false } );
    const dummy = { ...bundle };

    const merge = (a, b) => {
        for ( let i in a ) { a[i] += b && b[i] || ''; }
        return a;
    };
    const wrap = (a, wrap) => {
        if ( !wrap ) { return a }
        for ( let i in a ) {
            if ( !a[i] ) { continue } //++ simplify to 1 string
            a[i] = `${wrap} { ${a[i]} }`;
        }
        return a;
    };

    const distribute = rule => {
        // ++ can split here, actually
        const selector = rule.selectorText;
        const clearSelector = selector
            .replace( /\s:{1,2}(?:before|after)/gi, ' *' ) // .class ::before -> .class *
            .replace( /:{1,2}(?:before|after|focus\-within|focus\-visible|first\-letter|focus|hover|active|target|visited)/gi, '' ) // .class::before -> .class
            .replace( /:not\(\)/, '' ) // :not(:focus)
            .replace(/^[\,\s]+|[\,\s]+$/g, ''); // , .class,

        try { document.querySelector( clearSelector ) }
        catch { /* console.log( 'Bad selector: ' + clearSelector );*/ return }

        const elements = document.querySelectorAll( clearSelector );
        const inDOM = elements.length || false; // ++ || return;
        const inFirstScreen = Array.prototype.some.call( elements, el => { return dom.first.includes( el ) });

        return {
            first : inFirstScreen && rule.cssText || '',
            rest : inDOM && !inFirstScreen && rule.cssText || '',
            unused : !inDOM && rule.cssText || '',
            randu : !inFirstScreen && rule.cssText || '',
            all : rule.cssText || ''
        }
    };

    const process_style = (style) => {

        const process_rules = rules => { // ++is it even needed?

            let distributed = { ...dummy }; // ++rename the distributed to something easier

            for ( let rule of rules ) {
                const name = rule.constructor.name;

                if ( name === 'CSSMediaRule' ) {
                    distributed = merge( distributed, wrap( process_rules( rule.cssRules ), '@media '+rule.conditionText ) );
                    continue;
                }
                if ( name === 'CSSSupportsRule' ) {
                    distributed = merge( distributed, wrap( process_rules( rule.cssRules ), '@supports '+rule.conditionText ) );
                    continue;
                }
                if ( name === 'CSSFontFaceRule' ) {
                    rule.style.fontDisplay = 'swap'; // ++-- add to settings
                    distributed = merge( distributed, { first : rule.cssText } );
                    continue;
                }
                if ( name !== 'CSSStyleRule' ) {
                    // console.error( 'Not used rule ' + name ); console.log( rule );
                    // ignore CSSImportRule, as it is already retreived and parsed ++make proper printing!!
                    continue;
                }
                distributed = merge( distributed, distribute( rule ) );
            }
            return distributed;
        };

        const file_marker = '\n\n/* '+style.tag+(style.el.id?'#'+style.el.id:'')+(style.tag!=='style'?' '+style.url:'')+' */\n';
        let file_markers = { ...dummy };
        for ( let i in file_markers ) { file_markers[i] = file_marker; }
        return merge( file_markers, process_rules( style.parsed ) );
    };

    const doimported = imported => {
        if ( !imported.imported.length ) { return }
        for ( let style of imported.imported ) {
            doimported( style );
            bundle.add( wrap( process_style( style ), // add @media to import if media conditions are provided
                style.el.media?.mediaText ? '@media '+style.el.media.mediaText : ''
            ));
        }
    };
    for ( let style of structure ) {
        doimported( style );
        bundle.add( process_style( style ) );
    }

    return { ...bundle };
};

const new_styles = stylesBundle( allStyles );

//stylesBundle( allStyles )
//throw '';

/* it can effect the upper placed elements, if something is vertically centered or aligned by bottom
// remove elementsm which are not on the first screen, except fixed, which can be defined inside a rest-screen element
document.body.querySelectorAll( '*' ).forEach( el => {
    if ( dom.first.includes( el ) ) { return }
    el.remove();
}); //*/


//* remove the <style and <link
allStyles.forEach( style => {
    style.el.remove();
}); //*/

// print the first-screen style
const style = document.createElement( 'style' );
document.head.append( style );
style.textContent = new_styles.first;


// print the CSS
const printStyles = (title, content, total) => {
    const headline = document.createElement( 'h2' );
    document.body.append( headline );
    headline.innerHTML = title;// + '&nbsp;&nbsp; <small>'+( Math.round( content.length * 10000 / total ) / 100 )+'% of total</small>';
    const textarea = document.createElement( 'textarea' );
    document.body.append( textarea );
    textarea.value = content;
    textarea.style = `
        position:static;
        display:block;
        width:100%;
        height:50vh;
    `;
    textarea.addEventListener( 'click', (e) => {
        e.target.select();
    });
};

printStyles( 'First Screen CSS', new_styles.first, new_styles.all.length );
printStyles( 'Rest Screen CSS', new_styles.rest, new_styles.all.length );
printStyles( 'Unused CSS', new_styles.unused, new_styles.all.length );
printStyles( 'Rest Screen and Unused CSS', new_styles.randu, new_styles.all.length );

// print the styles structure in console
const structureShow = structure => {
    let lvl = 0;
    const doimported = imported => {
        if ( !imported.imported.length ) { return }
        lvl++;
        for ( let style of imported.imported ) {
            console.log( '\t '.repeat(lvl)+'▶'+style.tag+' '+style.url );
            doimported( style );
        }
        lvl--;
    };
    for ( let style of structure ) {
        console.log( '▶'+style.tag+(style.el.id?'#'+style.el.id:'')+(style.tag==='link'?' '+style.url:'') );
        doimported( style ); // import goes after only to show the structure, the imported content goes before the parent style
    }
};
structureShow( allStyles );

// ++beautify

// ++add the list to pick which styles to process_style

// ++should also separate selectors by , for smaller first screen and check each separately, but that will cause doubling of attributes on the rest screen
// ++exclude :focus, :hover and others from the first screen
// ++Yborlabs overflow (position:fixed) goes to second screen
// ++print structure to console
// ++print ignored rules to console
//++!!!! Y rest doesn't collect - compare with the initial script
// I blame selector going twice
// different % counting method - like by the number of selectors or properties
// fixed elements or their insides go to the rest, especially, borlabs
// ++add the list of slectors, that might appear in process - to keep in first or rest (and children as an option)
// ++!!effect only those I can effect, like with id and -css at the end of it, styles with -before and -after