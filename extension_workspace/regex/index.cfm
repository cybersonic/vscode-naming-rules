<cfquery name="elvis" datasource="elvis">
    Select * FROM thing
</cfquery>

<cfscript>

    dump(
        elvis
        );

</cfscript>


<style>
    body {
        background-color: #f0f0f0;
    }
</style>

<script>

    alert("Hello World");
</script>