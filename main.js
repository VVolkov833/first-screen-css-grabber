// ++ test cases for different url variants / a ./ ../ http://
// ++ test cases for recoursive media with different url variants
// ++ mention @import can behave like @media

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
const parseCSS = s => {
    const doc = document.implementation.createHTMLDocument( '' ),
          style = doc.createElement( 'style' );
    style.textContent = s;
    doc.body.appendChild( style );
    return style.sheet.cssRules;
};
const importStyles = async ( parsed ) => {
    let style = [];
    for ( let rule of parsed ) {
        if ( rule.constructor.name !== 'CSSImportRule' ) { break } // @import can only be at the start of a css document
        style.push( await styleStructure( rule ) );
    }
    return style;
};
const styleStructure = async (el) => {
    const url = el?.href || window.location.href,
          tag = el?.tagName?.toLowerCase() || '@import',
          content = el?.textContent || await getContent( url );
    let result = {
        tag,
        url,
        content,
        parsed : parseCSS( content ),
        el
    };

    result.imported = await importStyles( result.parsed ); // @import
    // ++media value before parsing

    return result;
};


let allStyles = []; // contains all tags providing styling
document.querySelectorAll( 'link[rel=stylesheet], style' ).forEach( ( el ) => {
    allStyles.push( el );
});
allStyles = await Promise.all( allStyles.map( styleStructure ) );

const structurePrint = structure => {
    let store = [];
    const imported = rules => {
        let store = [];
        if ( !rules.imported.length ) { return undefined }
        for ( let rule in rules.imported ) {
            store[rule] = [
                rules.imported[rule].tag+' '+rules.imported[rule].url+' '+rules.imported[rule].el.media.mediaText,
                imported( rules.imported[rule] ) || undefined
            ];
        }
        return store;
    };
    for ( let rule in structure ) {
        store[rule] = [
            structure[rule].el.tagName.toLowerCase()+(structure[rule].el.id?'#'+structure[rule].el.id:''),
            imported( structure[rule] ) || undefined // import goes after only to show the structure, the imported content goes before the parent style
        ];
    }
    return store;
};

console.log( structurePrint( allStyles ) );
throw '';



const getFirstScreenElements = () => {

    const win = {
        width: ( window.innerWidth || document.documentElement.clientWidth ) + 1,
        height: ( window.innerHeight || document.documentElement.clientHeight ) + 1
    };
    win.height = Math.round( win.height * 1.1 );

    const onFirstScreen = el => {
        const r = el.getBoundingClientRect();
        const s = { top: document.documentElement.scrollTop, left: document.documentElement.scrollLeft };
        return (
            r.top + s.top < win.height &&
            //r.bottom + s.top > 0 &&
            r.left + s.left < win.width //&&
            //r.right + s.left > 0
        );
    };

    let firstScreenElements = [];
    document.body.querySelectorAll( '*' ).forEach( el => {
        if ( !onFirstScreen( el ) ) { return; }
        firstScreenElements.push( el );
    });
    firstScreenElements.push( document.documentElement );
    firstScreenElements.push( document.body );

    return firstScreenElements;
};
let firstScreenElements = getFirstScreenElements();

const filterVisibleCSS = () => {

    let CSS = { firstScreenCSS: '', restScreenCSS: '', unusedCSS: '', restAndUnusedCSS: '' };

    const goThroughRules = ( list, ind ) => {

        const fixUrls = url => {
            return url.replace( /url\(('|")?(https?\:\/\/|\/|\/\/|data\:)?/gi, (m, m1, m2) => {
                if ( m2 ) { return m }
                return 'url(' + m1 + allStylesURLBase[ ind ];
            });
        };

        let css = {};
        Object.keys( CSS ).forEach( a => { css[ a ] = '' });

        Object.entries( list ).forEach( entry => {
            const [key, value] = entry;

            const wrappingRules = { CSSMediaRule: '@media', CSSSupportsRule: '@supports' };
            if ( Object.keys( wrappingRules ).includes( value.constructor.name ) ) {
                const c = goThroughRules( value.cssRules );
                const format = css => {
                    return css ? wrappingRules[ value.constructor.name ]+' '+value.conditionText+'{' + css + '}' : ''; // ++can format here with tabs and line breaks
                };
                Object.entries( c ).forEach( a => { css[ a[0] ] += format( a[1] ) });
                return;
            }

            if ( value.constructor.name === 'CSSFontFaceRule' ) {
                value.style.src = fixUrls( value.style.src );
                css.firstScreenCSS += value.cssText;
                return;
            }

            /*
            if ( value.constructor.name === 'CSSImportRule' ) {
                // ++assume, that it is absolute.. for now, as @import is not often used in our projects. write me if you want it working
                const replaceToken = '{{' + ind + key + '}}'; // save the place to add css after fetching and parsing
                firstScreenCSS += replaceToken;
                fetchContent( value.href ).then( t => { firstScreenCSS.replace( replaceToken, t ) } ); // ++parse ++filter
                return;
            }
            //*/
            if ( value.constructor.name !== 'CSSStyleRule' ) {
                //console.error( 'Not used rule ' + value.constructor.name ); console.log( value );
                return;
            }

            const clearSelector = value.selectorText
                .replace( /\s:{1,2}(?:before|after)/gi, ' *' ) // .class ::before -> .class *
                .replace( /:{1,2}(?:before|after|focus\-within|focus\-visible|first\-letter|focus|hover|active|target|visited)/gi, '' ) // .class::before -> .class
                .replace( /:not\(\)/, '' ) // :not(:focus)
                .replace(/^[\,\s]+|[\,\s]+$/g, ''); // , .class,
            try { // in case there are broken selectors after clearing..
                document.querySelector( clearSelector );
            } catch { return }

            const elements = document.querySelectorAll( clearSelector );

            const isInScreen = elements.length || false; // ++?? can return here
            const isInFirstScreen = Array.prototype.some.call( elements, el => { return firstScreenElements.includes( el ) });

            // fix url() address
            ['background', 'background-image', 'mask', 'mask-image'].forEach( att => {
                if ( !value.style[ att ] ) { return }
                value.style[ att ] = fixUrls( value.style[ att ] );
            });

            css.firstScreenCSS += isInFirstScreen && value.cssText || '';
            css.restScreenCSS += isInScreen && !isInFirstScreen && value.cssText || '';
            css.unusedCSS += !isInScreen && value.cssText || '';
            css.restAndUnusedCSS += isInScreen && value.cssText || '';

        });

        return css;
    };

    allStylesContentParsed.forEach( (s,i) => {
        const css = goThroughRules( s, i );
        Object.entries( css ).forEach( a => { CSS[ a[0] ] += a[1] });
    });

    return CSS;
};

const { firstScreenCSS, restScreenCSS, unusedCSS, restAndUnusedCSS } = filterVisibleCSS();

const style = document.createElement( 'style' );
document.body.prepend( style );
style.textContent = firstScreenCSS;

//    await new Promise( resolve => setTimeout( resolve, 5000 ) );

//* it can effect the upper placed elements, if something is vertically centered or aligned by bottom
// remove elementsm which are not on the first screen
firstScreenElements.push( style );
document.body.querySelectorAll( '*' ).forEach( el => {
    if ( firstScreenElements.includes( el ) ) { return; }
    el.remove();
}); //*/
// remove the <style and <link
allStyles.forEach( el => {
    el.remove();
});

// print the styles
const printStyles = (title,content) => {
    const headline = document.createElement( 'h2' );
    document.body.append( headline );
    headline.innerHTML = title;
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

printStyles( 'First Screen CSS', firstScreenCSS );
printStyles( 'Rest Screen CSS', restScreenCSS );
printStyles( 'Unused CSS', unusedCSS );
printStyles( 'Rest Screen and Unused CSS', restAndUnusedCSS );


// make the flat tree of styles first?

// found one undefined for the url base on https://plastische-chirurgie-giessler.de/home/leistungen/brust/bruststraffung/ with logo-giessler-sticky.png
// ++beautify

// ++add the list to pick which styles to proceed
// ++mention @import

// ++should also separate selectors by , for smaller first screen and check each separately, but that will cause doubling of attributes on the rest screen
// ++exclude :focus, :hover and others from the first screen
// ++borlabs overflow (position:fixed) goes to second screen