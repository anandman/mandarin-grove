// Native-export-only text scaling. Geometry, SVG attributes and source data stay intact.
function scaleNativeTextStyles(source){
 const scaled=value=>`calc((${value.trim()}) * var(--grove-text-scale, 1))`;
 return source.replace(/\bfont-size\s*:\s*([^;{}"'`]+)/g,(whole,value)=>{
  if(value.includes('--grove-text-scale'))return whole;
  const important=value.match(/\s*!important\s*$/)?.[0]||'',size=value.slice(0,value.length-important.length).trim();
  if(!/^(?:[\d.]+(?:px|rem)|(?:clamp|min|max|calc)\([\d\s.,()+*/%a-z-]+\))$/.test(size))return whole;
  return 'font-size:'+scaled(size)+important;
 }).replace(/\bfont\s*:\s*((?:(?:normal|italic|oblique|[1-9]00|bold|bolder|lighter)\s+)*)([\d.]+(?:px|rem))(?=[/\s])/g,(_,prefix,size)=>'font:'+prefix+scaled(size))
 .replace(/\bline-height\s*:\s*([\d.]+px)\b/g,(_,size)=>'line-height:'+scaled(size));
}
module.exports={scaleNativeTextStyles};
