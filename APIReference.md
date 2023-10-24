## API Reference
## Classes

<dl>
<dt><a href="#Collection">Collection</a></dt>
<dd><p>Collection operations supported by the driver.</p></dd>
</dl>

## Functions

<dl>
<dt><a href="#createAstraUri">createAstraUri(databaseId, region, keyspace, applicationToken, baseApiPath, logLevel, authHeaderName)</a> ⇒</dt>
<dd><p>Create an Astra connection URI while connecting to Astra JSON API</p></dd>
<dt><a href="#createStargateUri">createStargateUri(baseUrl, baseAuthUrl, keyspace, username, password, logLevel)</a> ⇒</dt>
<dd><p>Create a JSON API connection URI while connecting to Open source JSON API</p></dd>
<dt><a href="#getStargateAccessToken">getStargateAccessToken(authUrl, username, password)</a> ⇒</dt>
<dd><p>Get an access token from Stargate (this is useful while connecting to open source JSON API)</p></dd>
</dl>

<a name="Collection"></a>

## Collection
<p>Collection operations supported by the driver.</p>

**Kind**: global class  

* [Collection](#Collection)
    * ~~[.count()](#Collection+count)~~
    * ~~[.count(filter)](#Collection+count)~~
    * [.countDocuments(filter)](#Collection+countDocuments)
    * [.find(filter, options, callback)](#Collection+find)
    * [.findOne(filter, options)](#Collection+findOne)
    * [.insertOne(doc)](#Collection+insertOne)
    * [.insertMany(documents, options)](#Collection+insertMany)
    * [.findOneAndUpdate(filter, update, options)](#Collection+findOneAndUpdate)
    * [.findOneAndDelete(filter, options)](#Collection+findOneAndDelete)
    * [.findOneAndReplace(filter, newDoc, options)](#Collection+findOneAndReplace)
    * [.deleteMany(filter)](#Collection+deleteMany)
    * [.deleteOne(filter, options, callback)](#Collection+deleteOne)
    * [.updateOne(filter, update, options)](#Collection+updateOne)
    * [.updateMany(filter, update, options)](#Collection+updateMany)
    * [.bulkWrite(ops, options)](#Collection+bulkWrite)
    * [.aggregate(pipeline, options)](#Collection+aggregate)
    * [.bulkSave(docs, options)](#Collection+bulkSave)
    * [.cleanIndexes(options)](#Collection+cleanIndexes)
    * [.listIndexes(options)](#Collection+listIndexes)
    * [.createIndex(fieldOrSpec, options)](#Collection+createIndex)
    * [.dropIndexes()](#Collection+dropIndexes)
    * [.watch()](#Collection+watch)
    * [.distinct()](#Collection+distinct)
    * [.estimatedDocumentCount()](#Collection+estimatedDocumentCount)
    * [.replaceOne()](#Collection+replaceOne)
    * [.syncIndexes()](#Collection+syncIndexes)

<a name="Collection+count"></a>

### ~~collection.count()~~
***Deprecated***

**Kind**: instance method of [<code>Collection</code>](#Collection)  
<a name="Collection+count"></a>

### ~~collection.count(filter)~~
***Deprecated***

<p>Count documents in the collection that match the given filter. Use countDocuments() instead.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| filter | 

<a name="Collection+countDocuments"></a>

### collection.countDocuments(filter)
<p>Count documents in the collection that match the given filter.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| filter | 

<a name="Collection+find"></a>

### collection.find(filter, options, callback)
<p>Find documents in the collection that match the given filter.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| filter | 
| options | 
| callback | 

<a name="Collection+findOne"></a>

### collection.findOne(filter, options)
<p>Find a single document in the collection that matches the given filter.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| filter | 
| options | 

<a name="Collection+insertOne"></a>

### collection.insertOne(doc)
<p>Insert a single document into the collection.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| doc | 

<a name="Collection+insertMany"></a>

### collection.insertMany(documents, options)
<p>Insert multiple documents into the collection.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| documents | 
| options | 

<a name="Collection+findOneAndUpdate"></a>

### collection.findOneAndUpdate(filter, update, options)
<p>Update a single document in a collection.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| filter | 
| update | 
| options | 

<a name="Collection+findOneAndDelete"></a>

### collection.findOneAndDelete(filter, options)
<p>Find a single document in the collection and delete it.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| filter | 
| options | 

<a name="Collection+findOneAndReplace"></a>

### collection.findOneAndReplace(filter, newDoc, options)
<p>Find a single document in the collection and replace it.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| filter | 
| newDoc | 
| options | 

<a name="Collection+deleteMany"></a>

### collection.deleteMany(filter)
<p>Delete one or more documents in a collection that match the given filter.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| filter | 

<a name="Collection+deleteOne"></a>

### collection.deleteOne(filter, options, callback)
<p>Delete a single document in a collection that matches the given filter.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| filter | 
| options | 
| callback | 

<a name="Collection+updateOne"></a>

### collection.updateOne(filter, update, options)
<p>Update a single document in a collection that matches the given filter.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| filter | 
| update | 
| options | 

<a name="Collection+updateMany"></a>

### collection.updateMany(filter, update, options)
<p>Update multiple documents in a collection that match the given filter.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| filter | 
| update | 
| options | 

<a name="Collection+bulkWrite"></a>

### collection.bulkWrite(ops, options)
<p>Bulk write not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| ops | 
| options | 

<a name="Collection+aggregate"></a>

### collection.aggregate(pipeline, options)
<p>Aggregate not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| pipeline | 
| options | 

<a name="Collection+bulkSave"></a>

### collection.bulkSave(docs, options)
<p>Bulk Save not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| docs | 
| options | 

<a name="Collection+cleanIndexes"></a>

### collection.cleanIndexes(options)
<p>Clean indexes not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| options | 

<a name="Collection+listIndexes"></a>

### collection.listIndexes(options)
<p>List indexes not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| options | 

<a name="Collection+createIndex"></a>

### collection.createIndex(fieldOrSpec, options)
<p>Create index not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  

| Param |
| --- |
| fieldOrSpec | 
| options | 

<a name="Collection+dropIndexes"></a>

### collection.dropIndexes()
<p>Drop indexes not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  
<a name="Collection+watch"></a>

### collection.watch()
<p>Watch operation not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  
<a name="Collection+distinct"></a>

### collection.distinct()
<p>Distinct operation not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  
<a name="Collection+estimatedDocumentCount"></a>

### collection.estimatedDocumentCount()
<p>Estimated document count operation not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  
<a name="Collection+replaceOne"></a>

### collection.replaceOne()
<p>Replace one operation not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  
<a name="Collection+syncIndexes"></a>

### collection.syncIndexes()
<p>Sync indexes operation not supported.</p>

**Kind**: instance method of [<code>Collection</code>](#Collection)  
<a name="createAstraUri"></a>

## createAstraUri(databaseId, region, keyspace, applicationToken, baseApiPath, logLevel, authHeaderName) ⇒
<p>Create an Astra connection URI while connecting to Astra JSON API</p>

**Kind**: global function  
**Returns**: <p>URL as string</p>  

| Param | Description |
| --- | --- |
| databaseId | <p>the database id of the Astra database</p> |
| region | <p>the region of the Astra database</p> |
| keyspace | <p>the keyspace to connect to</p> |
| applicationToken | <p>an Astra application token</p> |
| baseApiPath | <p>baseAPI path defaults to /api/json/v1</p> |
| logLevel | <p>an winston log level (error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6)</p> |
| authHeaderName |  |

<a name="createStargateUri"></a>

## createStargateUri(baseUrl, baseAuthUrl, keyspace, username, password, logLevel) ⇒
<p>Create a JSON API connection URI while connecting to Open source JSON API</p>

**Kind**: global function  
**Returns**: <p>URL as string</p>  

| Param | Description |
| --- | --- |
| baseUrl | <p>the base URL of the JSON API</p> |
| baseAuthUrl | <p>the base URL of the JSON API auth (this is generally the Stargate Coordinator auth URL)</p> |
| keyspace | <p>the keyspace to connect to</p> |
| username | <p>the username to connect with</p> |
| password | <p>the password to connect with</p> |
| logLevel | <p>an winston log level (error: 0, warn: 1, info: 2, http: 3, verbose: 4, debug: 5, silly: 6)</p> |

<a name="getStargateAccessToken"></a>

## getStargateAccessToken(authUrl, username, password) ⇒
<p>Get an access token from Stargate (this is useful while connecting to open source JSON API)</p>

**Kind**: global function  
**Returns**: <p>access token as string</p>  

| Param | Description |
| --- | --- |
| authUrl | <p>the base URL of the JSON API auth (this is generally the Stargate Coordinator auth URL)</p> |
| username | <p>Username</p> |
| password | <p>Password</p> |

